// GitHub action
// Copyright © 2026 Alexander Thoukydides

import { Release } from './releases.js';
import * as core from '@actions/core';
import { formatList, plural } from './utils.js';

// Stripping configuration
export interface StripOptions {
    strip_links:    boolean;
    strip_images:   boolean;
    strip_html:     boolean;
    strip_regexps:  string[];
}

// Strip text from all release bodies
export function stripBodiesText(releases: Release[], options: StripOptions): Release[] {
    // Strip every body, counting the actions applied
    const count = new Map<string, number>();
    const stripped = releases.map(release => {
        const { body, applied } = stripBodyText(release.body, options);
        for (const key of applied) count.set(key, (count.get(key) ?? 0) + 1);
        return {...release, body};
    });
    const applied = [...count.entries()].map(([key, count]) => `${count} × ${key}`);
    if (applied.length) core.info(`Stripped ${plural(releases.length, 'release body')}: ${formatList(applied)}`);
    return stripped;
}

// Strip text from a single release body
function stripBodyText(body: string, config: StripOptions): { body: string, applied: string[] } {
    const { strip_links, strip_images, strip_html, strip_regexps } = config;

    // Replace all matches of a regexp, tracking those that modified the body
    const applied: string[] = [];
    const applyReplace = (name: string, pattern: RegExp, replacement = '') => {
        const stripped = body.replaceAll(pattern, replacement);
        if (stripped !== body) applied.push(name);
        body = stripped;
    };

    // Standardise line endings (matches CRLF/CR to LF)
    applyReplace('line-endings', /\r\n?/g, '\n');

    // Strip HTML or Markdown images
    if (strip_images) {
        applyReplace('md-images',   /!\[[^\]]*\]\([^)]*\)/g);
        applyReplace('html-images', /<img[^>]*>/gi, ' ');
    }

    // Strip HTML or Markdown links
    if (strip_links) {
        applyReplace('md-links',    /(?<!!)\[([^[\]]*(?:\[[^[\]]*\][^[\]]*)*)\]\([^)]*\)/g, '$1');
        applyReplace('html-links',  /<a[^>]*>([^<]*)<\/a>/gi, '$1');
    }

    // Strip all HTML tags
    if (strip_html) applyReplace('html-tags', /<[^>]*>/g, ' ');

    // Use all provided regular expressions to strip the bodies
    for (const strip_regexp of strip_regexps) {
        if (!strip_regexp) continue; // getMultilineInput trims *after* filtering blanks
        const [, pattern, flags] = /^\/((?:\\.|[^\\/])+)\/([dimsuv]*)$/.exec(strip_regexp) ?? [];
        if (!pattern || flags === undefined) throw new Error(`Invalid strip_regexps pattern: ${strip_regexp}`);
        const re = new RegExp(pattern, 'g' + flags); // (include global flag)
        applyReplace(strip_regexp, re);
    }
    return { body, applied };
}