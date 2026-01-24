// GitHub action
// Copyright © 2026 Alexander Thoukydides

import { Release } from './get_releases.js';
import * as core from '@actions/core';
import { plural } from './utils.js';

// Context options
export interface TruncateOptions {
    min_releases:  number;
    max_releases:  number;
    max_age_days:  number;
    max_chars:     number;
}

// Marker for any removed content
const TRUNCATION_MARKER = '\n\n*…truncated…*';

// Select the releases to include in the model's input context
export function truncateReleases(releases: Release[], options: TruncateOptions): Release[] {
    const { min_releases, max_releases, max_age_days, max_chars } = options;

    // Log progress fitting the releases within the available input context
    function logProgress(description: string): void {
        const chars = contextSize(releases);
        const deltaPercent = 100 * (chars - max_chars) / max_chars;
        const underOver = 0 < deltaPercent ? 'over' : 'under';
        core.info(`Progress [${description}]: ${plural(chars, 'character')}`
            + ` ${Math.abs(deltaPercent).toFixed(1)}% ${underOver} budget (${plural(releases.length, 'release')})`);
    }
    logProgress('Initial');

    // Find the lowest release that is not too old
    // (releases might not be chronological, so could include some older ones)
    const maxAgeReleases = max_age_days === 0 ? releases.length
        : releases.findLastIndex(r => releaseAge(r) <= max_age_days) + 1;

    // Determine how many releases fit within the size limit
    const maxSizeReleases = releases.findLastIndex((_, i) => contextSize(releases.slice(0, i + 1)) <= max_chars) + 1;

    // Choose the number of releases to use (ignoring token usage)
    const maxReleases = Math.min(max_releases || Infinity, maxAgeReleases, maxSizeReleases);
    const useReleases = Math.min(Math.max(min_releases, maxReleases), releases.length);
    core.info(`Selected ${useReleases} of ${plural(releases.length, 'release')}`
        + ` (${plural(maxAgeReleases, 'release')} under ${plural(max_age_days, 'day')},`
        + ` ${plural(maxSizeReleases, 'release')} under ${max_chars} characters)`);
    releases = releases.slice(0, useReleases);
    logProgress('Selected releases');

    // Truncate the bodies as necessary to fit within the context
    releases = truncateToFit(releases, max_chars);
    logProgress('Truncated bodies');

    // Return the truncated releases
    return releases;
}

// Age of a release in days
function releaseAge(release: Release): number {
    const milliseconds = Date.now() - new Date(release.published_at).getTime();
    return milliseconds / (24 * 60 * 60 * 1000);
}

// Size of the releases context in characters
function contextSize(releases: Release[]): number {
    return JSON.stringify(releases).length;
}

// Truncate the release bodies to fit within the specified character budget
function truncateToFit(releases: Release[], maxChars: number): Release[] {
    // Lower and upper bounds on the maximum body size
    let minBodyChars = 0;
    let maxBodyChars = Math.max(...releases.map(r => r.body.length));

    // Binary search to find the highest limit within the available size
    while (minBodyChars < maxBodyChars) {
        const testBodyChars = Math.ceil((minBodyChars + maxBodyChars) / 2);
        const testSize = contextSize(truncateReleaseBodies(releases, testBodyChars));
        if (testSize <= maxChars)   minBodyChars = testBodyChars;
        else                        maxBodyChars = testBodyChars - 1;
    }
    return truncateReleaseBodies(releases, maxBodyChars);
}

// Truncate all release bodies to the same maximum size
function truncateReleaseBodies(releases: Release[], maxChars: number): Release[] {
    return releases.map(({ body, ...rest }) => ({ body: truncateBody(body, maxChars), ...rest }));
}

// Truncate a release body to a maximum size
function truncateBody(body: string, maxChars: number): string {
    if (body.length <= maxChars) return body;

    // Try to break at a line boundary, if possible
    const maxBreakAt = maxChars - TRUNCATION_MARKER.length;
    if (maxBreakAt <= 0) return '';
    let breakAt = body.lastIndexOf('\n', maxChars);
    if (breakAt <= 0) breakAt = maxBreakAt;

    // Return the truncated body
    return body.substring(0, breakAt).trimEnd() + TRUNCATION_MARKER;
}