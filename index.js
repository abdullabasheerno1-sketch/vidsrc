import express from "express";
import { vidsrcBase } from "./src/common.js";
import { load } from "cheerio";
import { getVidsrcMovieSourcesId, getVidsrcShowSourcesId, getVidsrcSourceDetails, getVidsrcSources } from "./src/main.js";
import { encodeId, getFutoken } from "./src/utils.js";
import axios from "axios";
import randomUseragent from 'random-useragent';

const app = express()
const port = process.env.PORT || 3000

randomUseragent.getRandom();

var ip = (Math.floor(Math.random() * 255) + 1)+"."+(Math.floor(Math.random() * 255))+"."+(Math.floor(Math.random() * 255))+"."+(Math.floor(Math.random() * 255));

app.use(function (req, res, next) {
    if (req.originalUrl && req.originalUrl.split("/").pop() === 'favicon.ico') {
        return res.sendStatus(204);
    }
    next();
});

app.get('/', (req, res) => {
    res.status(200).json({
        intro: "Unofficial vidsrc API",
        routes: {
            movie: "/:movieTMDBid",
            show: "/:showTMDBid/:seasonNumber/:episodeNumber"
        },
        author: "by fr0zen"
    })
})

app.get('/:movieTMDBid', async(req, res) => {
    const movieId = req.params.movieTMDBid;

    const sourcesId = await getVidsrcMovieSourcesId(movieId);
    if(!sourcesId) return res.status(404).send({
        status: 404,
        return: "Oops movie not available"
    });

    const sources = await getVidsrcSources(sourcesId);
    const vidplay = sources.data.result.find((v) => v.title.toLowerCase() === 'vidplay');

    if(!vidplay) return res.status(404).json('vidplay stream not found for vidsrc');

    const vidplayLink = await getVidsrcSourceDetails(vidplay.id);
    
    const key = await encodeId(vidplayLink.split('/e/')[1].split('?')[0]);
    const data = await getFutoken(key, vidplayLink);

    let subtitles;
    {
		const subData = await axios.get(`${vidsrcBase}/embed/movie/${movieId}`, {
            headers: { "User-Agent": randomUseragent.getRandom(), "Referer": `${vidsrcBase}/` }
        });
		const doc = load(subData.data);
        const sourcesCode = doc('a[data-id]').attr('data-id');
        const subtitlesFetch = await axios.get(`${vidsrcBase}/ajax/embed/episode/${sourcesCode}/subtitles`, {
            headers: { "User-Agent": randomUseragent.getRandom(), "Referer": `${vidsrcBase}/` }
        });
        subtitles = await subtitlesFetch.data;
    }

    const response = await axios.get(`https://vidplay.online/mediainfo/${data}?${vidplayLink.split('?')[1]}&autostart=true`, {
        params: {
            v: Date.now().toString(),
        },
        headers: {
			"Origin": ip,
            "Referer": vidplayLink,
			"Host": "vidplay.online",
			"User-Agent": randomUseragent.getRandom()
        }
    });

    const result = response.data.result;

    if (!result && typeof result !== 'object') {
        throw new Error('an error occured');
    }

    const source = result.sources?.[0]?.file;
    if(!source) return res.status(404).send({
        status: 404,
        return: "Oops reached rate limit of this api"
    })

    res.status(200).json({
        source, subtitles
    })
})

app.get('/:showTMDBid/:seasonNum/:episodeNum', async(req, res) => {
    const showTMDBid = req.params.showTMDBid;
    const seasonNum = req.params.seasonNum;
    const episodeNum = req.params.episodeNum;

    const sourcesId = await getVidsrcShowSourcesId(showTMDBid, seasonNum, episodeNum);
    if(!sourcesId) return res.status(404).send({
        status: 404,
        return: "Oops show not available"
    });

    const sources = await getVidsrcSources(sourcesId);
    const vidplay = sources.data.result.find((v) => v.title.toLowerCase() === 'vidplay');

    if(!vidplay) return res.status(404).json('vidplay stream not found for vidsrc');

    const vidplayLink = await getVidsrcSourceDetails(vidplay.id);
    
    const key = await encodeId(vidplayLink.split('/e/')[1].split('?')[0]);
    const data = await getFutoken(key, vidplayLink);

    let subtitles;
    {
		const subData = await axios.get(`${vidsrcBase}/embed/tv/${showTMDBid}/${seasonNum}/${episodeNum}`, {
            headers: { "User-Agent": randomUseragent.getRandom(), "Referer": `${vidsrcBase}/` }
        });
        const doc = load(subData.data);
        const sourcesCode = doc('a[data-id]').attr('data-id');
        const subtitlesFetch = await axios.get(`${vidsrcBase}/ajax/embed/episode/${sourcesCode}/subtitles`, {
            headers: { "User-Agent": randomUseragent.getRandom(), "Referer": `${vidsrcBase}/` }
        });
        subtitles = await subtitlesFetch.data;
    }

    const response = await axios.get(`https://vidplay.online/mediainfo/${data}?${vidplayLink.split('?')[1]}&autostart=true`, {
        params: {
            v: Date.now().toString(),
        },
        headers: {
			"Origin": ip,
            "Referer": vidplayLink,
			"Host": "vidplay.online",
			"User-Agent": randomUseragent.getRandom()
        }
    });

    const result = response.data.result;

    if (!result && typeof result !== 'object') {
        throw new Error('an error occured');
    }

    const source = result.sources?.[0]?.file;
    if(!source) return res.status(404).send({
        status: 404,
        return: "Oops reached rate limit of this api"
    })

    res.status(200).json({
        source, subtitles
    })
})

app.listen(port, () => {
    console.log(`Example app listening on port http://localhost:${port}`)
})
