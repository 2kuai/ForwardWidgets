import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3/search/tv';

const DOULISTS = [
    { name: "迷雾剧场", id: "128396349" },
    { name: "白夜剧场", id: "158539495" },
    { name: "季风剧场", id: "153511846" },
    { name: "X剧场", id: "155026800" }
];

// Rate limiting configuration
const DOUBAN_RATE_LIMIT = {
    maxRequests: 10, // 10 requests per minute
    timeWindow: 60000, // 1 minute in milliseconds
    requestQueue: [],
    lastRequestTime: 0
};

// Rate limiting function for Douban requests
async function rateLimitedDoubanRequest(url, options = {}) {
    const now = Date.now();
    
    // Remove old requests from queue (older than 1 minute)
    DOUBAN_RATE_LIMIT.requestQueue = DOUBAN_RATE_LIMIT.requestQueue.filter(
        time => now - time < DOUBAN_RATE_LIMIT.timeWindow
    );
    
    // If we've reached the limit, wait until we can make another request
    if (DOUBAN_RATE_LIMIT.requestQueue.length >= DOUBAN_RATE_LIMIT.maxRequests) {
        const oldestRequest = DOUBAN_RATE_LIMIT.requestQueue[0];
        const timeToWait = DOUBAN_RATE_LIMIT.timeWindow - (now - oldestRequest);
        
        if (timeToWait > 0) {
            console.log(`Rate limit reached. Waiting ${Math.ceil(timeToWait / 1000)} seconds...`);
            await new Promise(resolve => setTimeout(resolve, timeToWait));
        }
        
        // Update queue after waiting
        DOUBAN_RATE_LIMIT.requestQueue = DOUBAN_RATE_LIMIT.requestQueue.filter(
            time => Date.now() - time < DOUBAN_RATE_LIMIT.timeWindow
        );
    }
    
    // Add current request to queue
    DOUBAN_RATE_LIMIT.requestQueue.push(Date.now());
    
    // Ensure minimum interval between requests (at least 1 second)
    const timeSinceLastRequest = now - DOUBAN_RATE_LIMIT.lastRequestTime;
    const minInterval = 1000; // 1 second minimum between requests
    if (timeSinceLastRequest < minInterval) {
        await new Promise(resolve => setTimeout(resolve, minInterval - timeSinceLastRequest));
    }
    
    DOUBAN_RATE_LIMIT.lastRequestTime = Date.now();
    
    console.log(`Making Douban request (${DOUBAN_RATE_LIMIT.requestQueue.length}/10 requests in current window)`);
    
    return axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1'
        },
        timeout: 10000,
        ...options
    });
}

function parseDoubanTitle(doubanTitle) {
    const match = doubanTitle.match(/^(.*?)(?:\((\d{4})\))?$/);
    if (match) {
        return {
            title: match[1].trim(),
            year: match[2] || null,
        };
    }
    return { title: doubanTitle.trim(), year: null };
}

// Get all pages data for a single doulist
async function fetchDoulistAllPages(doulistId, doulistName) {
    const doulistData = {
        name: doulistName,
        url: `https://m.douban.com/doulist/${doulistId}/`,
        shows: []
    };

    try {
        console.log(`\n=== Fetching data for doulist: ${doulistName} (ID: ${doulistId}) ===`);
        
        let allItems = [];
        let start = 0;
        const pageSize = 25;
        let hasNextPage = true;
        let pageCount = 0;

        // Loop through all pages
        while (hasNextPage) {
            pageCount++;
            const pageUrl = start === 0 ? 
                doulistData.url : 
                `${doulistData.url}?start=${start}`;
            
            console.log(`Fetching page ${pageCount}`, `URL: ${pageUrl}`);
            
            const response = await rateLimitedDoubanRequest(pageUrl);

            if (!response?.data) {
                console.error(`Page ${pageCount} data fetch failed for ${doulistName}`, "No response data");
                break;
            }
            
            console.log(`Page ${pageCount} HTML fetched successfully for ${doulistName}`, "Parsing...");
            const $ = cheerio.load(response.data);
            
            const items = $('ul.doulist-items > li');
            console.log(`Found ${items.length} items on page ${pageCount}`);
            
            if (items.length === 0) {
                console.log(`No items found on page ${pageCount}, stopping pagination`);
                break;
            }
            
            // Add current page items to total list
            items.each((index, element) => {
                const title = $(element).find('.info .title').text().trim();
                const meta = $(element).find('.info .meta').text().trim();
                
                // Extract year
                const yearMatch = meta.match(/(\d{4})(?=-\d{2}-\d{2})/);
                const year = yearMatch?.[1] || '';
                
                const showTitle = year ? `${title}(${year})` : title;
                allItems.push({ element: $(element), title: showTitle });
            });
            
            // Check if there's next page: if current page has less than 25 items, no next page
            if (items.length < pageSize) {
                hasNextPage = false;
                console.log(`Page ${pageCount} has ${items.length} items < ${pageSize}, no next page`);
            } else {
                start += pageSize;
                // Add delay between pages (already handled by rate limiting)
            }
        }
        
        console.log(`Doulist ${doulistName} completed: ${pageCount} pages, ${allItems.length} total items`);
        
        // Process all shows sequentially with rate limiting
        const shows = [];
        for (const [index, item] of allItems.entries()) {
            try {
                // Parse Douban title
                const { title: cleanTitle, year: parsedYear } = parseDoubanTitle(item.title);
                
                // Get TMDB data
                const tmdbData = await searchTMDB(cleanTitle, parsedYear);
                
                // Add delay between TMDB requests
                await new Promise(resolve => setTimeout(resolve, 500));

                if (tmdbData) {
                    const showData = {
                        doubanTitle: item.title,
                        tmdbData: tmdbData
                    };
                    console.log(`Success: Item ${index + 1}/${allItems.length}`, item.title);
                    shows.push(showData);
                } else {
                    console.log(`Failed: No TMDB data for item ${index + 1}/${allItems.length}`, item.title);
                }
                
            } catch (error) {
                console.error(`Error processing item ${index + 1} for ${doulistName}`, error.message);
            }
        }
        
        console.log(`✓ Doulist ${doulistName} processing completed: ${shows.length}/${allItems.length} shows found`);
        
        // Return complete show list without categorization
        return { 
            [doulistId]: {
                name: doulistName,
                shows: shows.map(show => show.tmdbData),
                totalItems: allItems.length,
                totalPages: pageCount,
                successfulMatches: shows.length
            }
        };
        
    } catch (error) {
        if (error.response) {
            console.error(`Request failed for ${doulistName}`, `Status: ${error.response.status}`);
        } else if (error.request) {
            console.error(`Request failed for ${doulistName}`, "No response");
        } else {
            console.error(`Request setup error for ${doulistName}`, error.message);
        }
        
        return { [doulistId]: { 
            name: doulistName, 
            shows: [], 
            totalItems: 0, 
            totalPages: 0,
            successfulMatches: 0,
            error: error.message 
        } };
    }
}

async function updateDoulistData() {
    try {
        console.log('Starting doulist data update...');
        console.log(`Total doulists to process: ${DOULISTS.length}`);
        
        const doulistResults = [];
        
        // Process each doulist sequentially
        for (const [index, doulist] of DOULISTS.entries()) {
            console.log(`\n--- Processing doulist ${index + 1}/${DOULISTS.length}: ${doulist.name} ---`);
            
            const result = await fetchDoulistAllPages(doulist.id, doulist.name);
            doulistResults.push(result);
            
            // Add delay between different doulists
            if (index < DOULISTS.length - 1) {
                console.log(`Waiting 2 seconds before processing next doulist...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        const data = {
            last_updated: new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace('Z', '+08:00'),
            total_doulists: DOULISTS.length,
        };

        console.log('\n=== Final Summary ===');
        for (const result of doulistResults) {
            const doulistId = Object.keys(result)[0];
            data[doulistId] = result[doulistId];
            const showCount = result[doulistId].shows.length;
            const totalItems = result[doulistId].totalItems;
            const totalPages = result[doulistId].totalPages;
            const successRate = totalItems > 0 ? ((showCount / totalItems) * 100).toFixed(1) : 0;
            
            console.log(`- ${doulistId} (${result[doulistId].name}): ${totalPages} pages, ${totalItems} items, ${showCount} TMDB matches (${successRate}% success rate)`);
        }
        
        const outputPath = path.join(__dirname, '..', 'data', 'doulist-data.json');
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf8');
        
        console.log('\n✓ Successfully updated data in doulist-data.json');
        
        return data;
    } catch (error) {
        console.error('Error updating data:', error);
        throw error;
    }
}

async function searchTMDB(title, year = null) {
    try {
        console.log(`Searching TMDB for: ${title}${year ? ` (${year})` : ''}`);
        const params = {
            query: title,
            language: 'zh-CN'
        };
        
        if (year) {
            params.first_air_date_year = year;
        }

        const response = await axios.get(TMDB_BASE_URL, {
            params,
            headers: {
                Authorization: `Bearer ${TMDB_API_KEY}`
            },
            timeout: 10000
        });
        
        if (response.data.results && response.data.results.length > 0) {
            // Find exact match
            const exactMatch = response.data.results.find(result => {
                // Compare titles (case insensitive and trim)
                const isTitleMatch = result.name.trim().toLowerCase() === title.trim().toLowerCase();
                
                // If year parameter exists, compare years
                if (year) {
                    const releaseYear = result.first_air_date ? new Date(result.first_air_date).getFullYear() : null;
                    return isTitleMatch && releaseYear === parseInt(year);
                }
                
                return isTitleMatch;
            });

            if (exactMatch) {
                console.log(`Found exact TMDB match for: ${title} -> ${exactMatch.name}`);
                return {
                    id: exactMatch.id,
                    type: "tmdb",
                    title: exactMatch.name,
                    description: exactMatch.overview,
                    posterPath: exactMatch.poster_path ? `https://image.tmdb.org/t/p/w500${exactMatch.poster_path}` : null,
                    backdropPath: exactMatch.backdrop_path ? `https://image.tmdb.org/t/p/w500${exactMatch.backdrop_path}` : null,
                    releaseDate: exactMatch.first_air_date,
                    rating: exactMatch.vote_average,
                    mediaType: "tv"
                };
            }
        }
        console.log(`No exact TMDB match found for: ${title}`);
        return null;
    } catch (error) {
        console.error(`Error searching TMDB for ${title}:`, error.message);
        return null;
    }
}

// Execute update
updateDoulistData().then(data => {
    console.log('Data update completed');
    process.exit(0);
}).catch(err => {
    console.error('Data update failed:', err);
    process.exit(1);
});
