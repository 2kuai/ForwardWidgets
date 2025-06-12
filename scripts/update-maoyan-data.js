const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
const TMDB_API_KEY = '3bbc78a7bcb275e63f9a352ce1985c83';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_REQUEST_DELAY = 250; // 250ms delay between requests
const OUTPUT_PATH = path.join(__dirname, '../data/update-maoyan-data.json');

const PLATFORMS = [
  { title: "全网", value: "0" },
  { title: "优酷", value: "1" },
  { title: "爱奇艺", value: "2" },
  { title: "腾讯视频", value: "3" },
  { title: "乐视视频", value: "4" },
  { title: "搜狐视频", value: "5" },
  { title: "PPTV", value: "6" },
  { title: "芒果TV", value: "7" 
];

// Helper functions
function cleanShowName(showName) {
  return showName.replace(/(第[\d一二三四五六七八九十]+季)/g, '').trim();
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// TMDB API functions
async function searchTMDB(showName) {
  try {
    const cleanedName = cleanShowName(showName);
    const url = `${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanedName)}&language=zh-CN`;
    
    const response = await axios.get(url);
    const data = response.data;
    
    if (data.results && data.results.length > 0) {
      const bestMatch = data.results[0];
      return {
        id: bestMatch.id,
        type: "tmdb",
        title: bestMatch.name,
        description: bestMatch.overview,
        posterPath: bestMatch.poster_path 
          ? `https://image.tmdb.org/t/p/w500${bestMatch.poster_path}` 
          : null,
        backdropPath: bestMatch.backdrop_path 
          ? `https://image.tmdb.org/t/p/w500${bestMatch.backdrop_path}` 
          : null,
        releaseDate: bestMatch.first_air_date,
        rating: bestMatch.vote_average,
        mediaType: "tv"
      };
    }
    return null;
  } catch (error) {
    console.error(`TMDB search error for "${showName}": ${error.message}`);
    return null;
  }
}

// Maoyan data fetching
async function fetchPlatformData(platformValue, platformTitle, seriesType) {
  try {
    const today = new Date();
    const showDate = today.getFullYear() +
      String(today.getMonth() + 1).padStart(2, '0') +
      String(today.getDate()).padStart(2, '0');

    console.log(`Fetching ${seriesType === '2' ? 'variety shows' : 'TV shows'} for ${platformTitle}...`);
    
    const url = `https://piaofang.maoyan.com/dashboard/webHeatData?showDate=${showDate}&seriesType=${seriesType}&platformType=${platformValue}`;
    
    const response = await axios.get(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "referer": "https://piaofang.maoyan.com/dashboard/web-heat"
      }
    });

    if (response.data?.dataList?.list) {
      const shows = response.data.dataList.list
        .filter(item => item.seriesInfo?.name)
        .map(item => ({
          originalName: item.seriesInfo.name,
          cleanedName: cleanShowName(item.seriesInfo.name)
        }));
      
      const enhancedShows = [];
      for (const show of shows) {
        await delay(TMDB_REQUEST_DELAY);
        const tmdbData = await searchTMDB(show.cleanedName);
        if (tmdbData) {
          enhancedShows.push(tmdbData);
        }
      }
      
      return enhancedShows;
    }
    return [];
  } catch (error) {
    console.error(`Error fetching data for ${platformTitle}: ${error.message}`);
    return [];
  }
}

// Main function
async function fetchMaoyanData() {
  const result = {
    tv: {},
    show: {},
    lastUpdated: new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace('Z', '+08:00'),
  };

  // Process all platforms in parallel
  await Promise.all([
    // TV shows
    (async () => {
      const tvResults = await Promise.all(
        PLATFORMS.map(async platform => ({
          platform: platform.title,
          shows: await fetchPlatformData(platform.value, platform.title, '')
        }))
      );
      tvResults.forEach(r => { result.tv[r.platform] = r.shows; });
    })(),
    
    // Variety shows
    (async () => {
      const showResults = await Promise.all(
        PLATFORMS.map(async platform => ({
          platform: platform.title,
          shows: await fetchPlatformData(platform.value, platform.title, '2')
        }))
      );
      showResults.forEach(r => { result.show[r.platform] = r.shows; });
    })()
  ]);

  return result;
}

// Execution
(async () => {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const result = await fetchMaoyanData();
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));
    
    console.log(`Data successfully saved to ${OUTPUT_PATH}`);
  } catch (error) {
    console.error('Script execution failed:', error);
    process.exit(1);
  }
})();
