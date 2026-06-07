//! Self-contained DBSCAN clustering (no external crates) ported from the legacy
//! Python `backend/main.py` `cluster_posts_into_events()`.
//!
//! Pure data in, pure data out — the SpacetimeDB reducer in `lib.rs` is
//! responsible for reading posts from `ctx.db`, calling [`dbscan`], and writing
//! the resulting `Event` rows + `post.event_id` updates.

/// A post reduced to just what clustering needs.
#[derive(Clone, Copy, Debug)]
pub struct PostPoint {
    pub id: u64,
    pub lat: f64,
    pub lng: f64,
    /// Capture time in whole seconds since the UNIX epoch.
    pub ts_secs: i64,
}

/// Tuning constants (mirror the MVP backend).
pub const EPS: f64 = 150.0; // neighborhood radius in the scaled feature space
pub const MIN_SAMPLES: usize = 3; // minimum points to form a cluster

// Meters-per-degree approximations at NYC latitude (~40.7°).
const LAT_METERS_PER_DEG: f64 = 111_000.0;
const LNG_METERS_PER_DEG: f64 = 85_000.0;
// Time scaling: 1 hour of separation == 100 "meters" of separation.
const SECONDS_PER_TIME_UNIT: f64 = 36.0; // 3600s / 100m

/// Project a point into the (x, y, t) feature space DBSCAN runs in.
fn features(p: &PostPoint) -> [f64; 3] {
    [
        p.lat * LAT_METERS_PER_DEG,
        p.lng * LNG_METERS_PER_DEG,
        p.ts_secs as f64 / SECONDS_PER_TIME_UNIT,
    ]
}

fn dist_sq(a: &[f64; 3], b: &[f64; 3]) -> f64 {
    (0..3).map(|i| (a[i] - b[i]).powi(2)).sum()
}

/// Run DBSCAN. Returns one label per input point, in input order:
/// `Some(cluster_index)` for clustered points, `None` for noise.
pub fn dbscan(points: &[PostPoint]) -> Vec<Option<usize>> {
    let n = points.len();
    let feats: Vec<[f64; 3]> = points.iter().map(features).collect();
    let eps_sq = EPS * EPS;

    let mut labels: Vec<Option<usize>> = vec![None; n];
    let mut visited = vec![false; n];
    let mut next_cluster = 0usize;

    let region_query = |idx: usize| -> Vec<usize> {
        (0..n)
            .filter(|&j| dist_sq(&feats[idx], &feats[j]) <= eps_sq)
            .collect()
    };

    for i in 0..n {
        if visited[i] {
            continue;
        }
        visited[i] = true;
        let mut neighbors = region_query(i);
        if neighbors.len() < MIN_SAMPLES {
            continue; // noise (may be reclaimed as a border point later)
        }

        let cluster = next_cluster;
        next_cluster += 1;
        labels[i] = Some(cluster);

        // Expand the cluster (index-based queue so we can grow it in place).
        let mut k = 0;
        while k < neighbors.len() {
            let j = neighbors[k];
            if !visited[j] {
                visited[j] = true;
                let j_neighbors = region_query(j);
                if j_neighbors.len() >= MIN_SAMPLES {
                    for nb in j_neighbors {
                        if !neighbors.contains(&nb) {
                            neighbors.push(nb);
                        }
                    }
                }
            }
            if labels[j].is_none() {
                labels[j] = Some(cluster);
            }
            k += 1;
        }
    }

    labels
}

/// Aggregate stats for one detected cluster.
#[derive(Clone, Debug)]
pub struct ClusterSummary {
    pub post_ids: Vec<u64>,
    pub center_lat: f64,
    pub center_lng: f64,
    pub radius_meters: f64,
    pub start_ts: i64,
    pub end_ts: i64,
    pub post_count: u32,
    /// Simple engagement proxy: 10 points per member post.
    pub heat_score: f64,
}

/// Group raw DBSCAN labels into per-cluster summaries.
pub fn summarize(points: &[PostPoint], labels: &[Option<usize>]) -> Vec<ClusterSummary> {
    use std::collections::BTreeMap;
    let mut groups: BTreeMap<usize, Vec<PostPoint>> = BTreeMap::new();
    for (p, label) in points.iter().zip(labels) {
        if let Some(c) = label {
            groups.entry(*c).or_default().push(*p);
        }
    }

    groups
        .into_values()
        .map(|members| {
            let count = members.len() as f64;
            let center_lat = members.iter().map(|m| m.lat).sum::<f64>() / count;
            let center_lng = members.iter().map(|m| m.lng).sum::<f64>() / count;
            let radius_meters = members
                .iter()
                .map(|m| crate::geo::haversine_meters(center_lat, center_lng, m.lat, m.lng))
                .fold(0.0_f64, f64::max);
            let start_ts = members.iter().map(|m| m.ts_secs).min().unwrap_or(0);
            let end_ts = members.iter().map(|m| m.ts_secs).max().unwrap_or(0);
            ClusterSummary {
                post_ids: members.iter().map(|m| m.id).collect(),
                center_lat,
                center_lng,
                radius_meters,
                start_ts,
                end_ts,
                post_count: members.len() as u32,
                heat_score: members.len() as f64 * 10.0,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn p(id: u64, lat: f64, lng: f64, ts: i64) -> PostPoint {
        PostPoint { id, lat, lng, ts_secs: ts }
    }

    #[test]
    fn groups_a_dense_cluster_and_drops_noise() {
        let base_ts = 1_700_000_000;
        let pts = vec![
            // Tight cluster in the East Village within ~minutes.
            p(1, 40.7265, -73.9815, base_ts),
            p(2, 40.7266, -73.9816, base_ts + 60),
            p(3, 40.7264, -73.9814, base_ts + 120),
            p(4, 40.7265, -73.9815, base_ts + 180),
            // Far-away lone post -> noise.
            p(99, 40.7580, -73.9855, base_ts + 90),
        ];
        let labels = dbscan(&pts);
        let summaries = summarize(&pts, &labels);
        assert_eq!(summaries.len(), 1);
        assert_eq!(summaries[0].post_count, 4);
        assert_eq!(labels[4], None); // the outlier is noise
    }
}
