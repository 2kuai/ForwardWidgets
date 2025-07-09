var WidgetMetadata = {
    id: "tv_live",
    title: "电视台",
    description: "获取热门电视直播频道",
    author: "两块",
    site: "https://github.com/2kuai/ForwardWidgets",
    version: "1.1.0",
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
                        { title: "全部", value: "all" },
                        { title: "央视", value: "cctv" },
                        { title: "卫视", value: "stv" },
                        { title: "地方", value: "ltv" }
                    ]
                }
            ]
        }
    ]
};

async function getLiveTv(params = {}) {
    try {
        const response = await Widget.http.get("https://raw.githubusercontent.com/2kuai/ForwardWidgets/refs/heads/main/data/iptv-data.json");
        
        if (!response?.data) {
            throw new Error("响应数据为空或格式不正确");
        }

        const modifiedData = { ...response.data };

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
                
                // 如果没有有效URL，返回null（后续会被过滤掉）
                if (allUrls.length === 0) return null;

                const mainUrl = allUrls[0];
                const backupUrls = allUrls.slice(1);
                
                // 处理备用线路
                const childItems = backupUrls.map((url, index) => ({
                    id: url,
                    type: "url",
                    title: `${item.name} - （${index + 1}）`,
                    backdropPath: item.backdrop_path,
                    description: item.description,
                    videoUrl: url
                }));
                
                // 构建主线路项
                const baseItem = {
                    id: mainUrl,
                    type: "url",
                    title: item.name,
                    backdropPath: item.backdrop_path,
                    description: item.description,
                    videoUrl: mainUrl
                };
                
                // 如果有备用线路，添加到子项
                if (childItems.length > 0) {
                    baseItem.childItems = childItems;
                }
                
                return baseItem;
            })
            .filter(item => item !== null); // 过滤掉无效的频道

        console.log("直播频道列表:", items);
        return items;
    } catch (error) {
        console.error("获取直播频道失败:", error.message);
        throw error;
    }
}