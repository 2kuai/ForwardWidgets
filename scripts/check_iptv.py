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

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('iptv_check.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

class SourceChecker:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        self.timeout = 10  # 全局超时设置

    def _ffprobe_check(self, url: str, is_rtmp: bool = False) -> Tuple[bool, str]:
        """只要ffprobe有输出就判为活着，不再要求流特征。"""
        try:
            if is_rtmp:
                probe_cmd = [
                    'ffprobe', '-v', 'error',
                    '-rw_timeout', '10000000',
                    '-select_streams', 'v:0',
                    '-show_entries', 'format=duration',
                    '-of', 'csv=print_section=0',
                    url
                ]
            else:
                probe_cmd = [
                    'ffprobe', '-v', 'error',
                    '-timeout', '10000000',
                    '-select_streams', 'v:0',
                    '-show_entries', 'stream=codec_name,width,height',
                    '-of', 'csv=print_section=0',
                    url
                ]
            probe_result = subprocess.run(
                probe_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=self.timeout
            )
            if probe_result.returncode != 0:
                error_msg = probe_result.stderr.decode('utf-8').strip()
                return False, f"FFprobe验证失败: {error_msg if error_msg else '未知错误'}"
            output = probe_result.stdout.decode('utf-8').strip()
            if output:
                return True, "ffprobe有输出，判为活着"
            else:
                return False, "ffprobe无输出"
        except subprocess.TimeoutExpired:
            return False, "FFprobe检测超时"
        except Exception as e:
            return False, f"FFprobe检测异常: {str(e)}"

    def check_source_advanced(self, url: str) -> Tuple[str, str, Optional[float], Optional[float]]:
        """GET只判断状态码是否200，不判断Content-Type。ffprobe成功为high，GET成功但ffprobe失败为medium，GET失败为fail。"""
        def _detect():
            try:
                logger.debug(f"开始GET检测: {url}")
                start_get = time.time()
                resp = self.session.get(url, timeout=self.timeout, stream=True)
                get_time = time.time() - start_get
                if resp.status_code != 200:
                    logger.debug(f"GET状态码非200: {url} {resp.status_code}")
                    return 'fail', f'GET状态码: {resp.status_code}', get_time, None
                logger.debug(f"GET成功: {url} 状态码: {resp.status_code} 用时: {get_time:.2f}s")
                # ffprobe检测
                start_probe = time.time()
                ok, msg = self._ffprobe_check(url)
                probe_time = time.time() - start_probe
                logger.debug(f"ffprobe检测: {url} 结果: {ok} {msg} 用时: {probe_time:.2f}s")
                if ok:
                    return 'high', 'ffprobe通过', get_time, probe_time
                else:
                    return 'medium', f'GET成功, ffprobe失败: {msg}', get_time, probe_time
            except Exception as e:
                logger.debug(f"GET检测异常: {url} {e}")
                return 'fail', f'GET失败: {e}', None, None
        status, reason, get_time, probe_time = _detect()
        if status == 'fail':
            logger.debug(f"首次检测失败，重试: {url}")
            time.sleep(1)
            status, reason, get_time, probe_time = _detect()
        return status, reason, get_time, probe_time

    def check_http_source(self, url):
        try:
            # 直接GET部分内容
            try:
                get_response = self.session.get(
                    url,
                    timeout=self.timeout,
                    stream=True
                )
                get_response.raise_for_status()
                content_type = get_response.headers.get('Content-Type', '').lower()
                if 'text/html' in content_type:
                    return False, "Content-Type为HTML"
                # 检查内容签名（可选）
                try:
                    chunk = next(get_response.iter_content(1024), b'')
                    if any(sig in chunk for sig in [b'#EXTM3U', b'FLV', b'ftyp']):
                        return True, "内容签名通过"
                except Exception:
                    pass  # 内容签名检测失败不影响整体判断
                # 能GET到内容且不是HTML就算有效
                return True, "GET成功，内容类型有效"
            except requests.RequestException as e:
                return False, f"GET请求失败: {str(e)}"
        except Exception as e:
            return False, f"HTTP检测异常: {str(e)}"

    def check_rtmp_source(self, url):
        """RTMP源专用检测"""
        try:
            # 基本URL解析
            parsed = urlparse(url)
            if not parsed.netloc:
                return False, "无效的RTMP URL"

            # 使用FFprobe进行RTMP验证
            return self._ffprobe_check(url, is_rtmp=True)
            
        except Exception as e:
            return False, f"RTMP检测异常: {str(e)}"

def check_dependencies() -> list:
    """检查所有必要依赖是否安装"""
    required_tools = ['ffmpeg', 'ffprobe']
    missing_tools = []
    for tool in required_tools:
        try:
            subprocess.run(
                [tool, '-version'],
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
    """处理单个频道及其所有源，GET成功全部保留，ffprobe结果只影响排序，GET失败的不保留。"""
    if 'childItems' not in channel or not channel['childItems']:
        return channel
    checker = SourceChecker()
    results = []
    SLOW_THRESHOLD = 5.0
    urls = channel['childItems']
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_url = {executor.submit(checker.check_source_advanced, url): url for url in urls}
        for future in concurrent.futures.as_completed(future_to_url):
            url = future_to_url[future]
            try:
                status, reason, get_time, probe_time = future.result()
            except Exception as exc:
                status, reason, get_time, probe_time = 'fail', f'检测异常: {exc}', None, None
            total_time = (get_time or 0) + (probe_time or 0)
            speed = 'fast' if total_time <= SLOW_THRESHOLD else 'slow'
            logger.info(f"[RESULT] 状态: {status} | 速率: {speed} | 总耗时: {total_time:.2f}s | 频道: {channel.get('name','')} | URL: {url} | 原因: {reason}")
            if status in ('high', 'medium'):
                results.append((status, total_time, url))
    # 排序：high > medium，同级别按total_time升序
    results.sort(key=lambda x: (0 if x[0]=='high' else 1, x[1]))
    channel['childItems'] = [item[2] for item in results]
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
    parser.add_argument('-o', '--output', default='data/iptv_data.json', help='输出JSON文件路径')
    parser.add_argument('-w', '--workers', type=int, default=10, help='并发工作线程数')
    parser.add_argument('-v', '--verbose', action='store_true', help='启用详细日志')
    args = parser.parse_args()
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    main(args.input, args.output, args.workers)
