import { vidsrcBase } from "./common.js";
import { load } from "cheerio";
import axios from "axios";
import { decryptSourceUrl } from "./utils.js";
import randomUseragent from 'random-useragent';

const getHeaders = () => ({
    "User-Agent": randomUseragent.getRandom(),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Referer": `${vidsrcBase}/`
});

export async function getVidsrcMovieSourcesId(tmdbId) {
    try {
        const data = await axios.get(`${vidsrcBase}/embed/movie/${tmdbId}`, { headers: getHeaders() });
        const doc = load(data.data);
        return doc('a[data-id]').attr('data-id');
    } catch (err) {
        return;
    }
}

export async function getVidsrcShowSourcesId(tmdbId, seasonNumber, episodeNumber) {
    try {
        const data = await axios.get(`${vidsrcBase}/embed/tv/${tmdbId}/${seasonNumber}/${episodeNumber}`, { headers: getHeaders() });
        const doc = load(data.data);
        return doc('a[data-id]').attr('data-id');
    } catch (err) {
        return;
    }
}

export async function getVidsrcSources(sourceId) {
    const data = await axios.get(`${vidsrcBase}/ajax/embed/episode/${sourceId}/sources`, { headers: getHeaders() });
    return data;
}

export async function getVidsrcSourceDetails(sourceId) {
    const data = await axios.get(`${vidsrcBase}/ajax/embed/source/${sourceId}`, { headers: getHeaders() });
    const encryptedUrl = data.data.result.url;
    const decryptedUrl = decryptSourceUrl(encryptedUrl);
    return decodeURIComponent(decryptedUrl);
}
