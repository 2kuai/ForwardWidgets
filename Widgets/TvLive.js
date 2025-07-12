var WidgetMetadata = {
    id: "tv_live",
    title: "电视台",
    description: "获取热门电视直播频道",
    author: "两块",
    site: "https://github.com/2kuai/ForwardWidgets",
    version: "1.1.3",
    requiredVersion: "0.0.1",
    modules: [
        {
            title: "电视频道",
            description: "热门电视频道",
            requiresWebView: false,
            functionName: "getLiveTv",
            params: [
                {
                    name: "sort_by",
                    title: "类型",
                    type: "enumeration",
                    enumOptions: [
                        { title: "全部频道", value: "all" },
                        { title: "央视频道", value: "cctv" },
                        { title: "卫视频道", value: "stv" },
                        { title: "地方频道", value: "ltv" }
                    ]
                },
                {
                    name: "url",
                    title: "用户订阅",
                    type: "input",
                    description: "输入M3U格式订阅链接"
                },
                {
                    name: "bg_color",
                    title: "台标背景色",
                    type: "input",
                    description: "支持RGB颜色，如DCDCDC",
                    placeholders: [
                        { title: "雾霾灰", value: "90A4AE" },
                        { title: "暖灰色", value: "424242" },
                        { title: "深灰色", value: "1C1C1E" }
                    ]
                }
            ]
        }
    ]
};


async function getLiveTv(params = {}) {
    try {
        // 获取固定订阅数据
        const response = await Widget.http.get("https://raw.githubusercontent.com/2kuai/ForwardWidgets/refs/heads/main/data/iptv-data.json");
        
        if (!response?.data) {
            throw new Error("响应数据为空或格式不正确");
        }

        const modifiedData = { ...response.data };
        let addedSourcesCount = 0; // 记录添加的有效源数量

        // 处理用户订阅
        if (params.url) {
            try {
                const userResponse = await Widget.http.get(params.url);
                if (userResponse?.data) {
                    // 解析M3U格式的用户订阅数据
                    const userChannels = parseM3U(userResponse.data);
                    console.log(`从用户订阅中解析出 ${userChannels.length} 个频道`);
                    
                    // 将用户订阅合并到固定订阅中
                    for (const category in modifiedData) {
                        if (Array.isArray(modifiedData[category])) {
                            modifiedData[category] = modifiedData[category].map(item => {
                                // 查找匹配的用户订阅频道
                                const matchedUserChannels = userChannels.filter(
                                    userItem => userItem.name === item.name
                                );
                                
                                if (matchedUserChannels.length > 0) {
                                    // 获取当前频道已有的URL
                                    const existingUrls = new Set(
                                        (item.childItems || [])
                                            .filter(url => typeof url === 'string' && url.trim().length > 0)
                                    );
                                    
                                    // 添加新的不重复的URL
                                    const newUrls = matchedUserChannels
                                        .map(channel => channel.url)
                                        .filter(url => !existingUrls.has(url));
                                    
                                    if (newUrls.length > 0) {
                                        addedSourcesCount += newUrls.length;
                                        console.log(`为频道 ${item.name} 添加了 ${newUrls.length} 个新源`);
                                        return {
                                            ...item,
                                            childItems: [
                                                ...(item.childItems || []),
                                                ...newUrls
                                            ].filter(Boolean)
                                        };
                                    }
                                }
                                return item;
                            });
                        }
                    }
                    console.log(`共添加了 ${addedSourcesCount} 个有效源`);
                }
            } catch (userError) {
                console.error("处理用户订阅失败:", userError.message);
                // 用户订阅失败不影响主流程
            }
        }

        // 将所有频道合并到"all"分类
        const allChannels = Object.values(modifiedData)
            .filter(channels => Array.isArray(channels))
            .flat();

        modifiedData["all"] = allChannels;

        // 检查请求的分类是否存在
        if (!params.sort_by || !modifiedData[params.sort_by]) {
            throw new Error(`不支持的类型: ${params.sort_by}`);
        }
        
        // 处理频道数据
        const items = modifiedData[params.sort_by]
            .map((item) => {
                const allUrls = (item.childItems || [])
                    .filter(url => typeof url === 'string' && url.trim().length > 0);
                
                if (allUrls.length === 0) return null;

                // 创建频道项的函数
                const createChannelItem = (url, title, isMain = false) => ({
                    id: url,
                    type: "url",
                    title: isMain ? item.name : title,
                    backdropPath: item.backdrop_path.replace(/bg-\w{6}/g, params.bg_color ? `bg-${params.bg_color}` : '$&'),
                    description: item.description,
                    videoUrl: url
                });

                const mainUrl = allUrls[0];
                const baseItem = createChannelItem(mainUrl, item.name, true);
                
                // 处理备用线路
                if (allUrls.length > 1) {
                    baseItem.childItems = allUrls.slice(1).map((url, index) => 
                        createChannelItem(url, `${item.name} - （${index + 1}）`)
                    );
                }
                
                return baseItem;
            })
            .filter(item => item !== null);
            
        return items;
    } catch (error) {
        console.error("获取直播频道失败:", error.message);
        throw error;
    }
}

// 辅助函数：解析M3U格式数据
function parseM3U(m3uContent) {
    const lines = m3uContent.split('\n');
    const channels = [];
    let currentChannel = {};
    
    for (const line of lines) {
        if (line.startsWith('#EXTINF')) {
            // 解析频道信息
            const nameMatch = line.match(/tvg-name="([^"]+)"/);
            if (nameMatch) {
                currentChannel.name = nameMatch[1];
            } else {
                // 如果没有tvg-name，尝试从标题中提取
                const titleMatch = line.match(/,([^,]+)$/);
                if (titleMatch) {
                    currentChannel.name = titleMatch[1].trim();
                }
            }
        } else if (line.trim() && !line.startsWith('#') && currentChannel.name) {
            // 这是URL行
            currentChannel.url = line.trim();
            channels.push(currentChannel);
            currentChannel = {};
        }
    }
    
    return channels;
}