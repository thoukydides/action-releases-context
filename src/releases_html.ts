/// <reference lib="dom" />
// GitHub action
// Copyright © 2026 Alexander Thoukydides

import { fetchReleasesDocument, Release } from './releases.js';
import { extractMarkdownReleases } from './releases_md.js';
import TurndownService from 'turndown';
import * as core from '@actions/core';

// Retrieve releases from an HTML changelog
export async function getHtmlReleases(url: string, html_regexps: string[], md_release_regexp: string): Promise<Release[]> {
    // Retrieve the HTML changelog
    let html = await fetchReleasesDocument(url);

    // Use all provided regular expressions to transform the HTML
    for (const html_regexp of html_regexps) {
        if (!html_regexp) continue; // getMultilineInput trims *after* filtering blanks

        // Construct the regular expression
        const [, pattern, flags, replacement] = /^\/((?:\\.|[^\\/])+)\/([dimsuv]*)(?:\s+'(.*)')?$/.exec(html_regexp) ?? [];
        if (!pattern || flags === undefined) throw new Error(`Invalid html_regexps pattern: ${html_regexp}`);
        const re = new RegExp(pattern, 'g' + flags); // (include global flag)

        // Perform the replacement
        html = html.replaceAll(re, replacement ?? '');
    }
    core.debug(`Transformed HTML:\n${html}`);

    // Convert from HTML to Markdown
    const markdown = htmlToMarkdown(html);
    core.debug(`Markdown:\n${markdown}`);

    // Extract the releases
    return extractMarkdownReleases(markdown, md_release_regexp);
}

// Convert from HTML to Markdown
function htmlToMarkdown(html: string): string {
    // Create an HTML to Markdown converter
    const turndownService = new TurndownService({ headingStyle: 'atx' });

    // Use a single space after list markers (default is three spaces)
    turndownService.addRule('tightListItem', {
        filter:         (node)      => node.nodeName === 'LI',
        replacement:    (content, node) => {
            const prefix = node.parentNode?.nodeName === 'OL' ? '1. ' : '- ';
            content = content.trim().replace(/(?<=\n)/gm, ' '.repeat(prefix.length));
            return `${prefix}${content}${node.nextSibling ? '\n' : ''}`;
        }
    });

    // Apply the conversion
    return turndownService.turndown(html);
}