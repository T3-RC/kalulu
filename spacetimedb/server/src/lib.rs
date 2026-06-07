//! Kalulu — SpacetimeDB server module (production).
//!
//! Tables + reducers + scheduled DBSCAN clustering. Tables and reducers must
//! live in the crate root so the `#[table]` / `#[reducer]` macros register them;
//! pure helpers live in `geo` and `clustering`.
//!
//! API target: SpacetimeDB 1.x / 2.0. Two spots are version-sensitive and
//! flagged inline: verified against spacetimedb 1.12.0 (ScheduleAt/TimeDuration OK;
//! Identity uses to_string()). See inline notes if you change versions. The
//! standalone pure-logic crate also passes `cargo test`.

use spacetimedb::{reducer, table, Identity, ReducerContext, ScheduleAt, Table, Timestamp};

mod clustering;
mod geo;

use clustering::PostPoint;

// ============================================================================
// TABLES
// ============================================================================

#[table(name = users, public)]
pub struct User {
    #[primary_key]
    pub id: Identity,
    #[unique]
    pub username: String,
    pub email: String,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub created_at: Timestamp,
}

#[table(name = posts, public)]
pub struct Post {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub user_id: Identity,
    pub media_url: String,
    pub thumbnail_url: Option<String>,
    #[index(btree)]
    pub latitude: f64,
    pub longitude: f64,
    pub timestamp: Timestamp,
    pub caption: Option<String>,
    pub neighborhood: Option<String>,
    #[index(btree)]
    pub event_id: Option<u64>,
    pub visibility: String, // "public" | "private" | "hidden"
    pub created_at: Timestamp,
}

#[table(name = events, public)]
pub struct Event {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub name: String,
    pub center_lat: f64,
    pub center_lng: f64,
    pub radius_meters: f64,
    pub start_time: Timestamp,
    pub end_time: Timestamp,
    pub post_count: u32,
    pub heat_score: f64,
    pub neighborhood: Option<String>,
    pub created_at: Timestamp,
}

#[table(name = likes, public)]
pub struct Like {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub user_id: Identity,
    #[index(btree)]
    pub post_id: u64,
    pub created_at: Timestamp,
}

#[table(name = comments, public)]
pub struct Comment {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub user_id: Identity,
    #[index(btree)]
    pub post_id: u64,
    pub content: String,
    pub created_at: Timestamp,
}

#[table(name = follows, public)]
pub struct Follow {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    #[index(btree)]
    pub follower_id: Identity,
    pub following_id: Identity,
    pub created_at: Timestamp,
}

/// Drives periodic clustering. A single row is inserted in `init`; SpacetimeDB
/// then calls `run_clustering` on the configured interval.
#[table(name = clustering_schedule, scheduled(run_clustering))]
pub struct ClusteringSchedule {
    #[primary_key]
    #[auto_inc]
    pub scheduled_id: u64,
    pub scheduled_at: ScheduleAt,
}

// ============================================================================
// LIFECYCLE REDUCERS
// ============================================================================

/// Runs once when the module is first published. Seeds the clustering schedule.
#[reducer(init)]
pub fn init(ctx: &ReducerContext) {
    // Run clustering every 5 minutes.
    //
    // VERSION NOTE: if `TimeDuration::from_micros` is unavailable on your
    // version, use `ScheduleAt::Interval(std::time::Duration::from_secs(300).into())`.
    let five_minutes = spacetimedb::TimeDuration::from_micros(5 * 60 * 1_000_000);
    ctx.db.clustering_schedule().insert(ClusteringSchedule {
        scheduled_id: 0,
        scheduled_at: ScheduleAt::Interval(five_minutes),
    });
    log::info!("Kalulu module initialized; clustering scheduled every 5m");
}

/// Runs whenever a client connects. Ensures a `User` row exists for the caller.
#[reducer(client_connected)]
pub fn client_connected(ctx: &ReducerContext) {
    if ctx.db.users().id().find(ctx.sender).is_none() {
        // NOTE: verified against spacetimedb 1.12.0 — Identity uses to_string() (hex).
        let hex = ctx.sender.to_string();
        let short = &hex[..hex.len().min(8)];
        ctx.db.users().insert(User {
            id: ctx.sender,
            username: format!("user_{short}"),
            email: String::new(),
            display_name: None,
            avatar_url: None,
            created_at: ctx.timestamp,
        });
        log::info!("Created user {short}");
    }
}

// ============================================================================
// USER REDUCERS
// ============================================================================

#[reducer]
pub fn set_profile(
    ctx: &ReducerContext,
    username: Option<String>,
    display_name: Option<String>,
    avatar_url: Option<String>,
    email: Option<String>,
) -> Result<(), String> {
    let mut user = ctx
        .db
        .users()
        .id()
        .find(ctx.sender)
        .ok_or("User does not exist; connect first")?;

    if let Some(name) = username {
        let name = name.trim().to_string();
        if name.is_empty() {
            return Err("Username must not be empty".into());
        }
        // Enforce uniqueness manually for a friendly error (the #[unique] index
        // would otherwise abort with a constraint violation).
        if ctx
            .db
            .users()
            .iter()
            .any(|u| u.id != ctx.sender && u.username.eq_ignore_ascii_case(&name))
        {
            return Err("Username already taken".into());
        }
        user.username = name;
    }
    if let Some(dn) = display_name {
        user.display_name = Some(dn);
    }
    if let Some(av) = avatar_url {
        user.avatar_url = Some(av);
    }
    if let Some(em) = email {
        user.email = em;
    }
    ctx.db.users().id().update(user);
    Ok(())
}

// ============================================================================
// POST REDUCERS
// ============================================================================

#[reducer]
pub fn create_post(
    ctx: &ReducerContext,
    media_url: String,
    latitude: f64,
    longitude: f64,
    timestamp: Timestamp,
    caption: Option<String>,
) -> Result<(), String> {
    if media_url.trim().is_empty() {
        return Err("Media URL is required".into());
    }
    if !(-90.0..=90.0).contains(&latitude) || !(-180.0..=180.0).contains(&longitude) {
        return Err("Coordinates out of range".into());
    }

    let neighborhood = geo::detect_neighborhood(latitude, longitude);
    ctx.db.posts().insert(Post {
        id: 0, // assigned by #[auto_inc]
        user_id: ctx.sender,
        media_url,
        thumbnail_url: None,
        latitude,
        longitude,
        timestamp,
        caption,
        neighborhood: Some(neighborhood),
        event_id: None,
        visibility: "public".into(),
        created_at: ctx.timestamp,
    });
    // Clustering runs on the schedule, not inline (see Common Pitfalls).
    Ok(())
}

#[reducer]
pub fn set_thumbnail(ctx: &ReducerContext, post_id: u64, thumbnail_url: String) -> Result<(), String> {
    let mut post = ctx.db.posts().id().find(post_id).ok_or("No such post")?;
    if post.user_id != ctx.sender {
        return Err("Not your post".into());
    }
    post.thumbnail_url = Some(thumbnail_url);
    ctx.db.posts().id().update(post);
    Ok(())
}

#[reducer]
pub fn set_post_visibility(ctx: &ReducerContext, post_id: u64, visibility: String) -> Result<(), String> {
    if !matches!(visibility.as_str(), "public" | "private" | "hidden") {
        return Err("Invalid visibility".into());
    }
    let mut post = ctx.db.posts().id().find(post_id).ok_or("No such post")?;
    if post.user_id != ctx.sender {
        return Err("Not your post".into());
    }
    post.visibility = visibility;
    ctx.db.posts().id().update(post);
    Ok(())
}

#[reducer]
pub fn delete_post(ctx: &ReducerContext, post_id: u64) -> Result<(), String> {
    let post = ctx.db.posts().id().find(post_id).ok_or("No such post")?;
    if post.user_id != ctx.sender {
        return Err("Not your post".into());
    }
    // Cascade: remove likes and comments tied to this post.
    let like_ids: Vec<u64> = ctx.db.likes().iter().filter(|l| l.post_id == post_id).map(|l| l.id).collect();
    for id in like_ids {
        ctx.db.likes().id().delete(id);
    }
    let comment_ids: Vec<u64> = ctx.db.comments().iter().filter(|c| c.post_id == post_id).map(|c| c.id).collect();
    for id in comment_ids {
        ctx.db.comments().id().delete(id);
    }
    ctx.db.posts().id().delete(post_id);
    Ok(())
}

// ============================================================================
// SOCIAL REDUCERS
// ============================================================================

#[reducer]
pub fn like_post(ctx: &ReducerContext, post_id: u64) -> Result<(), String> {
    if ctx.db.posts().id().find(post_id).is_none() {
        return Err("No such post".into());
    }
    if ctx.db.likes().iter().any(|l| l.user_id == ctx.sender && l.post_id == post_id) {
        return Err("Already liked".into());
    }
    ctx.db.likes().insert(Like {
        id: 0,
        user_id: ctx.sender,
        post_id,
        created_at: ctx.timestamp,
    });
    Ok(())
}

#[reducer]
pub fn unlike_post(ctx: &ReducerContext, post_id: u64) -> Result<(), String> {
    let ids: Vec<u64> = ctx
        .db
        .likes()
        .iter()
        .filter(|l| l.user_id == ctx.sender && l.post_id == post_id)
        .map(|l| l.id)
        .collect();
    for id in ids {
        ctx.db.likes().id().delete(id);
    }
    Ok(())
}

#[reducer]
pub fn add_comment(ctx: &ReducerContext, post_id: u64, content: String) -> Result<(), String> {
    let content = content.trim().to_string();
    if content.is_empty() {
        return Err("Comment must not be empty".into());
    }
    if content.len() > 2000 {
        return Err("Comment too long".into());
    }
    if ctx.db.posts().id().find(post_id).is_none() {
        return Err("No such post".into());
    }
    ctx.db.comments().insert(Comment {
        id: 0,
        user_id: ctx.sender,
        post_id,
        content,
        created_at: ctx.timestamp,
    });
    Ok(())
}

#[reducer]
pub fn delete_comment(ctx: &ReducerContext, comment_id: u64) -> Result<(), String> {
    let comment = ctx.db.comments().id().find(comment_id).ok_or("No such comment")?;
    if comment.user_id != ctx.sender {
        return Err("Not your comment".into());
    }
    ctx.db.comments().id().delete(comment_id);
    Ok(())
}

#[reducer]
pub fn follow_user(ctx: &ReducerContext, following_id: Identity) -> Result<(), String> {
    if ctx.sender == following_id {
        return Err("Cannot follow yourself".into());
    }
    if ctx
        .db
        .follows()
        .iter()
        .any(|f| f.follower_id == ctx.sender && f.following_id == following_id)
    {
        return Err("Already following".into());
    }
    ctx.db.follows().insert(Follow {
        id: 0,
        follower_id: ctx.sender,
        following_id,
        created_at: ctx.timestamp,
    });
    Ok(())
}

#[reducer]
pub fn unfollow_user(ctx: &ReducerContext, following_id: Identity) -> Result<(), String> {
    let ids: Vec<u64> = ctx
        .db
        .follows()
        .iter()
        .filter(|f| f.follower_id == ctx.sender && f.following_id == following_id)
        .map(|f| f.id)
        .collect();
    for id in ids {
        ctx.db.follows().id().delete(id);
    }
    Ok(())
}

// ============================================================================
// SCHEDULED CLUSTERING
// ============================================================================

const MICROS_PER_SEC: i64 = 1_000_000;
const CLUSTER_WINDOW_SECS: i64 = 24 * 3600;

/// Scheduled reducer: cluster the last 24h of un-clustered public posts into
/// events. Called automatically per the `clustering_schedule` interval.
#[reducer]
pub fn run_clustering(ctx: &ReducerContext, _schedule: ClusteringSchedule) -> Result<(), String> {
    let now_secs = ctx.timestamp.to_micros_since_unix_epoch() / MICROS_PER_SEC;
    let cutoff = now_secs - CLUSTER_WINDOW_SECS;

    // Collect candidate points: public, not yet clustered, within the window.
    let points: Vec<PostPoint> = ctx
        .db
        .posts()
        .iter()
        .filter(|p| p.event_id.is_none() && p.visibility == "public")
        .map(|p| PostPoint {
            id: p.id,
            lat: p.latitude,
            lng: p.longitude,
            ts_secs: p.timestamp.to_micros_since_unix_epoch() / MICROS_PER_SEC,
        })
        .filter(|pp| pp.ts_secs >= cutoff)
        .collect();

    if points.len() < clustering::MIN_SAMPLES {
        return Ok(());
    }

    let labels = clustering::dbscan(&points);
    let summaries = clustering::summarize(&points, &labels);

    let mut created = 0u32;
    for s in summaries {
        let neighborhood = geo::detect_neighborhood(s.center_lat, s.center_lng);
        let hour = (s.start_ts.rem_euclid(86_400) / 3_600) as u32;
        let (y, m, d) = civil_from_unix(s.start_ts);
        let name = format!(
            "{} {} - {:04}-{:02}-{:02}",
            neighborhood,
            geo::time_of_day(hour),
            y,
            m,
            d
        );

        // Insert the event, then stamp its id onto each member post.
        let inserted = ctx.db.events().insert(Event {
            id: 0,
            name,
            center_lat: s.center_lat,
            center_lng: s.center_lng,
            radius_meters: s.radius_meters,
            start_time: Timestamp::from_micros_since_unix_epoch(s.start_ts * MICROS_PER_SEC),
            end_time: Timestamp::from_micros_since_unix_epoch(s.end_ts * MICROS_PER_SEC),
            post_count: s.post_count,
            heat_score: s.heat_score,
            neighborhood: Some(neighborhood),
            created_at: ctx.timestamp,
        });

        for pid in s.post_ids {
            if let Some(mut post) = ctx.db.posts().id().find(pid) {
                post.event_id = Some(inserted.id);
                ctx.db.posts().id().update(post);
            }
        }
        created += 1;
    }

    if created > 0 {
        log::info!("Clustering created {created} event(s)");
    }
    Ok(())
}

/// Civil (year, month, day) from a UNIX timestamp in seconds.
/// Howard Hinnant's `civil_from_days` algorithm — no external crate needed.
fn civil_from_unix(secs: i64) -> (i64, u32, u32) {
    let days = secs.div_euclid(86_400);
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097; // [0, 146096]
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365; // [0, 399]
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // [0, 365]
    let mp = (5 * doy + 2) / 153; // [0, 11]
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32; // [1, 31]
    let m = (if mp < 10 { mp + 3 } else { mp - 9 }) as u32; // [1, 12]
    (if m <= 2 { y + 1 } else { y }, m, d)
}

#[cfg(test)]
mod tests {
    use super::civil_from_unix;

    #[test]
    fn civil_date_matches_known_epoch() {
        assert_eq!(civil_from_unix(0), (1970, 1, 1));
        // 2021-01-01T00:00:00Z = 1609459200
        assert_eq!(civil_from_unix(1_609_459_200), (2021, 1, 1));
    }
}
  