import { vidsrcBase } from "./common.js";
import { load } from "cheerio";
import axios from "axios";
import { decryptSourceUrl } from "./utils.js";
import randomUseragent from 'random-useragent';

const getHeaders = (customReferer = `${vidsrcBase}/`) => ({
    "User-Agent": randomUseragent.getRandom(),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": customReferer,
    "Sec-Ch-Ua": '"Not-A.Brand";v="99", "Chromium";v="120"',
    "Sec-Ch-Ua-Mobile": "?1",
    "Sec-Ch-Ua-Platform": '"Android"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1"
});

export async function getVidsrcMovieSourcesId(tmdbId) {
    try {
        const url = `${vidsrcBase}/embed/movie/${tmdbId}`;
        const data = await axios.get(url, { headers: getHeaders(url) });
        const doc = load(data.data);
        return doc('a[data-id]').attr('data-id');
    } catch (err) {
        console.error("Error fetching movie sources ID:", err.message);
        return;
    }
}

export async function getVidsrcShowSourcesId(tmdbId, seasonNumber, episodeNumber) {
    try {
        const url = `${vidsrcBase}/embed/tv/${tmdbId}/${seasonNumber}/${episodeNumber}`;
        const data = await axios.get(url, { headers: getHeaders(url) });
        const doc = load(data.data);
        return doc('a[data-id]').attr('data-id');
    } catch (err) {
        console.error("Error fetching show sources ID:", err.message);
        return;
    }
}

export async function getVidsrcSources(sourceId) {
    const url = `${vidsrcBase}/ajax/embed/episode/${sourceId}/sources`;
    const data = await axios.get(url, { headers: getHeaders(`${vidsrcBase}/`) });
    return data;
}

export async function getVidsrcSourceDetails(sourceId) {
    const url = `${vidsrcBase}/ajax/embed/source/${sourceId}`;
    const data = await axios.get(url, { headers: getHeaders(`${vidsrcBase}/`) });
    const encryptedUrl = data.data.result.url;
    const decryptedUrl = decryptSourceUrl(encryptedUrl);
    return decodeURIComponent(decryptedUrl);
}
