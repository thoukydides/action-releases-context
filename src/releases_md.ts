// GitHub action
// Copyright © 2026 Alexander Thoukydides

import { fetchReleasesDocument, Release } from './releases.js';
import * as core from '@actions/core';
import { isValidDate } from './utils.js';

// Default patterns to recognise release headers
const DEFAULT_RELEASE_PATTERNS = [
    /^#+ .*\b(?<version>v?\d+\.\d+\.\d+)\b.*\b(?<date>\d\d\d\d-\d\d?-\d\d?)\b.*$/gm,
    /^#+ .*\b(?<date>\d\d\d\d-\d\d?-\d\d?)\b.*\b(?<version>v?\d+\.\d+\.\d+)\b.*$/gm
];

// Retrieve releases from a Markdown changelog
export async function getMarkdownReleases(url: string, md_release_regexp: string): Promise<Release[]> {
    // Retrieve the Markdown changelog
    const markdown = await fetchReleasesDocument(url);

    // Extract the releases
    return extractMarkdownReleases(markdown, md_release_regexp);
}

// Extract releases from a Markdown changelog
export function extractMarkdownReleases(markdown: string, md_release_regexp: string): Release[] {
    // Use the first pattern with matches
    const patterns = prepareMarkdownPatterns(md_release_regexp);
    const matches = patterns.reduce<RegExpExecArray[]>((match, pattern) =>
        match.length ? match : [...markdown.matchAll(pattern)], []);

    // Convert to individual releases
    return matches.map((match, index) => {
        const bodyStart = match.index + match[0].length;
        const bodyEnd   = matches[index + 1]?.index;
        return {
            version:    match.groups?.version,
            date:       normaliseDate(match.groups?.date ?? ''),
            body:       markdown.substring(bodyStart, bodyEnd).trim()
        } satisfies Release;
    });
}

// Prepare regular expression(s) for extracting releases from Markdown
function prepareMarkdownPatterns(md_release_regexp: string): RegExp[] {
    if (!md_release_regexp) return DEFAULT_RELEASE_PATTERNS;
    const [, pattern, flags] = /^\/((?:\\.|[^\\/])+)\/([dimsuv]*)$/.exec(md_release_regexp) ?? [];
    if (!pattern || flags === undefined) throw new Error(`Invalid html_regexps pattern: ${md_release_regexp}`);
    return [new RegExp(pattern, 'g' + flags)]; // (include global flag)
}

// Attempt to normalise a dates to ISO 8601 date-only format
function normaliseDate(date: string): string {
    const parsed = new Date(date);
    if (!isValidDate(parsed)) {
        if (date) core.debug(`Invalid date: ${date}`);
        return date;
    }
    // (date.toISOString() would convert from local timezone to UTC)
    const year  = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day   = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}