// GitHub action
// Copyright © 2026 Alexander Thoukydides

import * as core from '@actions/core';
import { plural } from './utils.js';

// A simplified representation of a release
export interface Release {
    version?:   string;
    date?:      string;
    body:       string;
}

// Fetch a document by URL
export async function fetchReleasesDocument(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to retrieve ${url}: ${response.status} ${response.statusText}`);
    const text = await response.text();
    core.info(`Retrieved ${plural(text.length, 'character')} from ${url}`);
    core.debug(text);
    return text;
}