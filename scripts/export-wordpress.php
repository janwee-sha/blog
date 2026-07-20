<?php

declare(strict_types=1);

// This script runs inside the local WordPress container and writes only a
// whitelisted, public migration snapshot to stdout. It never writes to WordPress.
define('WP_USE_THEMES', false);
require '/var/www/html/wp-load.php';

function migration_terms(int $post_id, string $taxonomy): array
{
    $terms = wp_get_post_terms($post_id, $taxonomy);
    if (is_wp_error($terms)) {
        throw new RuntimeException($terms->get_error_message());
    }

    return array_map(
        static fn(WP_Term $term): array => [
            'id' => (int) $term->term_id,
            'name' => $term->name,
            'slug' => $term->slug,
        ],
        $terms
    );
}

function migration_attachment(int $attachment_id): ?array
{
    $attachment = get_post($attachment_id);
    if (!$attachment || $attachment->post_type !== 'attachment' || $attachment->post_status !== 'inherit') {
        return null;
    }

    return [
        'id' => (int) $attachment->ID,
        'title' => get_the_title($attachment),
        'url' => wp_get_attachment_url($attachment_id) ?: '',
        'file' => (string) get_post_meta($attachment_id, '_wp_attached_file', true),
        'mime_type' => (string) $attachment->post_mime_type,
        'status' => (string) $attachment->post_status,
        'alt' => (string) get_post_meta($attachment_id, '_wp_attachment_image_alt', true),
        'metadata' => wp_get_attachment_metadata($attachment_id) ?: [],
    ];
}

$public_posts = get_posts([
    'post_type' => ['post', 'page'],
    'post_status' => 'publish',
    'post_password' => '',
    'numberposts' => -1,
    'orderby' => ['date' => 'ASC', 'ID' => 'ASC'],
    'suppress_filters' => false,
]);

$posts = [];
$author_ids = [];

foreach ($public_posts as $post) {
    $author_ids[(int) $post->post_author] = true;
    $posts[] = [
        'id' => (int) $post->ID,
        'type' => $post->post_type,
        'slug' => $post->post_name,
        'title' => get_the_title($post),
        'excerpt' => $post->post_excerpt,
        'content' => $post->post_content,
        'date' => $post->post_date,
        'date_gmt' => $post->post_date_gmt,
        'modified' => $post->post_modified,
        'modified_gmt' => $post->post_modified_gmt,
        'author_id' => (int) $post->post_author,
        'categories' => migration_terms((int) $post->ID, 'category'),
        'tags' => migration_terms((int) $post->ID, 'post_tag'),
        'elementor_data' => (string) get_post_meta($post->ID, '_elementor_data', true),
        'thumbnail_id' => (int) get_post_thumbnail_id($post),
        'seo' => [
            'title' => (string) get_post_meta($post->ID, 'wds_title', true),
            'description' => (string) get_post_meta($post->ID, 'wds_metadesc', true),
            'primary_category' => (int) get_post_meta($post->ID, 'wds_primary_category', true),
        ],
    ];
}

$attachments = [];
foreach (get_posts([
    'post_type' => 'attachment',
    'post_status' => 'inherit',
    'numberposts' => -1,
    'orderby' => 'ID',
    'order' => 'ASC',
]) as $attachment) {
    $item = migration_attachment((int) $attachment->ID);
    if ($item !== null) {
        $attachments[(string) $item['id']] = $item;
    }
}

$authors = [];
foreach (array_keys($author_ids) as $author_id) {
    $user = get_userdata((int) $author_id);
    if (!$user) {
        continue;
    }
    $avatar_id = (int) get_user_meta((int) $author_id, $GLOBALS['wpdb']->prefix . 'user_avatar', true);
    $authors[] = [
        'id' => (int) $author_id,
        'display_name' => $user->display_name,
        'description' => get_user_meta((int) $author_id, 'description', true),
        'avatar_id' => $avatar_id,
        'github' => (string) get_user_meta((int) $author_id, 'github', true),
    ];
}

$site_icon_id = (int) get_option('site_icon', 0);
$snapshot = [
    'exported_at' => gmdate('c'),
    'wordpress_version' => get_bloginfo('version'),
    'site' => [
        'name' => get_bloginfo('name'),
        'description' => get_bloginfo('description'),
        'language' => get_bloginfo('language'),
        'timezone' => wp_timezone_string(),
        'site_url' => get_option('siteurl'),
        'home_url' => get_option('home'),
        'permalink_structure' => get_option('permalink_structure'),
        'site_icon_id' => $site_icon_id,
    ],
    'authors' => $authors,
    'posts' => $posts,
    'attachments' => $attachments,
];

$json = wp_json_encode($snapshot, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
if ($json === false) {
    throw new RuntimeException('Unable to encode the WordPress migration snapshot.');
}

fwrite(STDOUT, $json . PHP_EOL);
