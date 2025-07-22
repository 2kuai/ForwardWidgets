#!/usr/bin/env python3
import json
import os
import subprocess
import concurrent.futures
from datetime import datetime
import logging
import requests
import time
from urllib.parse import urlparse
from typing import Tuple, Optional

# 配置日志 - 只保留控制台输出
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

class SourceChecker:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        self.timeout = 30  # 全局超时设置

    def _vlc_check(self, url: str) -> Tuple[bool, str]:
        """用cvlc检测直播源（支持rtmp等），分析输出内容，只有包含关键字才判为可用。"""
        try:
            # --intf dummy: 无界面
            # --run-time=15: 最多加载15秒
            # -vvv: 最高详细度日志
            vlc_cmd = [
                'cvlc', '--intf', 'dummy', '--run-time=15', '-vvv', url
            ]
            result = subprocess.run(
                vlc_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=self.timeout  # 最长30秒超时
            )
            output = (result.stdout.decode('utf-8', errors='ignore') + '\n' + result.stderr.decode('utf-8', errors='ignore')).lower()
            keywords = ['audio output', 'video output', 'decoder', 'stream_out', 'rtmp', 'demux']
            if any(kw in output for kw in keywords):
                return True, "cvlc检测通过，输出包含关键字，判为可用"
            else:
                return False, f"cvlc检测失败: 输出不包含关键字。部分输出: {output[:200]}"
        except subprocess.TimeoutExpired:
            return False, "cvlc检测超时"
        except Exception as e:
            return False, f"cvlc检测异常: {str(e)}"

    def check_source_vlc_only(self, url: str) -> Tuple[bool, str, Optional[float]]:
        """只用cvlc检测，只要能正常播放就判为可用。"""
        start_check = time.time()
        ok, msg = self._vlc_check(url)
        check_time = time.time() - start_check
        return ok, msg, check_time

def check_dependencies() -> list:
    """检查所有必要依赖是否安装"""
    required_tools = ['cvlc']
    missing_tools = []
    for tool in required_tools:
        try:
            subprocess.run(
                [tool, '--version'],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=5
            )
            logger.info(f"{tool} 检测通过")
        except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired) as e:
            missing_tools.append(tool)
            logger.error(f"{tool} 检测失败: {str(e)}")
    return missing_tools

def process_channel(channel: dict, max_workers: int = 10) -> dict:
    """处理单个频道及其所有源，只用cvlc检测，检测通过的全部保留。"""
    if 'childItems' not in channel or not channel['childItems']:
        return channel
    checker = SourceChecker()
    results = []
    SLOW_THRESHOLD = 10.0
    urls = channel['childItems']
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_url = {executor.submit(checker.check_source_vlc_only, url): url for url in urls}
        for future in concurrent.futures.as_completed(future_to_url):
            url = future_to_url[future]
            try:
                ok, msg, check_time = future.result()
            except Exception as exc:
                ok, msg, check_time = False, f'检测异常: {exc}', None
            speed = 'fast' if (check_time or 0) <= SLOW_THRESHOLD else 'slow'
            logger.info(
                f"\n频道: 【{channel.get('name','')}】  {url}"
                f"\n状态: {'ok' if ok else 'fail'} | 速率: {speed} | 耗时: {check_time:.2f}s"
                f"\n结果: {msg}"
            )
            if ok:
                results.append((check_time, url))
    # 按check_time升序排序
    results.sort(key=lambda x: x[0])
    channel['childItems'] = [item[1] for item in results]
    return channel

def main(input_file: str, output_file: str, max_workers: int = 10):
    """主函数"""
    logger.info("开始IPTV源检测")
    missing_tools = check_dependencies()
    if missing_tools:
        logger.error(f"错误: 缺少必要工具 {', '.join(missing_tools)}")
        return
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        logger.info(f"成功读取输入文件: {input_file}")
    except Exception as e:
        logger.error(f"读取输入文件失败: {str(e)}")
        return
    data['last_updated'] = datetime.now().isoformat()
    for category in data:
        if isinstance(data[category], list):
            count = len(data[category])
            logger.info(f"处理分类: {category} (共 {count} 个频道)")
            data[category] = [process_channel(channel, max_workers) for channel in data[category]]
            logger.info(f"分类 {category} 完成")
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    temp_file = output_file + '.tmp'
    try:
        with open(temp_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        os.replace(temp_file, output_file)
        logger.info(f"检测完成，结果已保存到: {output_file}")
    except Exception as e:
        logger.error(f"保存结果失败: {str(e)}")
        if os.path.exists(temp_file):
            os.unlink(temp_file)

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('-i', '--input', default='iptv_sources.json', help='输入JSON文件路径')
    parser.add_argument('-o', '--output', default='data/iptv-data.json', help='输出JSON文件路径')
    parser.add_argument('-w', '--workers', type=int, default=10, help='并发工作线程数')
    parser.add_argument('-v', '--verbose', action='store_true', help='启用详细日志')
    args = parser.parse_args()
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    main(args.input, args.output, args.workers)
