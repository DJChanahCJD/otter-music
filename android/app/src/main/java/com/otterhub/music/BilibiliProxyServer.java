package com.otterhub.music;

import fi.iki.elonen.NanoHTTPD;
import fi.iki.elonen.NanoHTTPD.IHTTPSession;
import fi.iki.elonen.NanoHTTPD.Response;
import fi.iki.elonen.NanoHTTPD.Response.Status;

import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.List;
import java.util.Map;

/**
 * 本地HTTP代理服务器，用于B站音频流式播放
 * 将带Referer等header的B站请求转换为本地可播放的URL
 */
public class BilibiliProxyServer extends NanoHTTPD {

    private static final int DEFAULT_PORT = 8765;
    private static final String USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

    public BilibiliProxyServer() {
        super(DEFAULT_PORT);
    }

    public BilibiliProxyServer(int port) {
        super(port);
    }

    @Override
    public Response serve(IHTTPSession session) {
        String uri = session.getUri();
        Map<String, String> params = session.getParms();

        // 只处理/proxy路径
        if (!"/proxy".equals(uri)) {
            return Response.newFixedLengthResponse(Status.NOT_FOUND, "text/plain", "Not Found");
        }

        String audioUrl = params.get("url");
        String bvid = params.get("bvid");

        if (audioUrl == null || bvid == null) {
            return Response.newFixedLengthResponse(Status.BAD_REQUEST, "text/plain", "Missing url or bvid parameter");
        }

        try {
            return proxyBilibiliAudio(audioUrl, bvid, session);
        } catch (Exception e) {
            return Response.newFixedLengthResponse(Status.INTERNAL_ERROR, "text/plain", "Proxy error: " + e.getMessage());
        }
    }

    private Response proxyBilibiliAudio(String audioUrl, String bvid, IHTTPSession session) throws IOException {
        URL url = new URL(audioUrl);
        final HttpURLConnection connection = (HttpURLConnection) url.openConnection();

        try {
            // 设置请求方法
            String method = session.getMethod().name();
            connection.setRequestMethod(method);

            // 透传Range请求头
            Map<String, String> headers = session.getHeaders();
            String rangeHeader = headers.get("range");
            if (rangeHeader != null) {
                connection.setRequestProperty("Range", rangeHeader);
            }

            // 设置B站必需的header
            connection.setRequestProperty("User-Agent", USER_AGENT);
            connection.setRequestProperty("Referer", "https://www.bilibili.com/video/" + bvid);
            connection.setRequestProperty("Origin", "https://www.bilibili.com");

            // 透传其他相关header
            String[] headersToPass = {"Accept", "Accept-Encoding", "Accept-Language", "Connection"};
            for (String h : headersToPass) {
                String val = headers.get(h.toLowerCase());
                if (val != null) {
                    connection.setRequestProperty(h, val);
                }
            }

            connection.setConnectTimeout(10000);
            connection.setReadTimeout(30000);
            connection.setDoInput(true);
            connection.setDoOutput(false);

            connection.connect();

            int responseCode = connection.getResponseCode();
            String contentType = connection.getContentType();
            long contentLength = connection.getContentLengthLong();

            InputStream inputStream;
            if (responseCode >= 200 && responseCode < 300) {
                inputStream = connection.getInputStream();
            } else {
                inputStream = connection.getErrorStream();
            }

            // 包装 InputStream：当流关闭时断开连接
            final InputStream stream = inputStream;
            InputStream wrappedStream = new InputStream() {
                @Override
                public int read() throws IOException { return stream.read(); }
                @Override
                public int read(byte[] b, int off, int len) throws IOException { return stream.read(b, off, len); }
                @Override
                public void close() throws IOException {
                    try { stream.close(); } finally { connection.disconnect(); }
                }
                @Override
                public int available() throws IOException { return stream.available(); }
            };

            Response response;
            if (contentLength > 0) {
                response = Response.newFixedLengthResponse(
                    Status.lookup(responseCode),
                    contentType,
                    wrappedStream,
                    contentLength
                );
            } else {
                response = Response.newChunkedResponse(
                    Status.lookup(responseCode),
                    contentType,
                    wrappedStream
                );
            }

            // 透传关键响应头到客户端
            String[] headersToPassBack = {"Content-Range", "Accept-Ranges", "ETag", "Last-Modified", "Cache-Control"};
            for (String h : headersToPassBack) {
                String val = connection.getHeaderField(h);
                if (val != null) {
                    response.addHeader(h, val);
                }
            }

            // 添加CORS头
            response.addHeader("Access-Control-Allow-Origin", "*");
            response.addHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");

            return response;
        } catch (Exception e) {
            connection.disconnect();
            throw e;
        }
    }

    /**
     * 获取本地代理URL
     */
    public String getProxyUrl(String audioUrl, String bvid) {
        try {
            String encodedUrl = java.net.URLEncoder.encode(audioUrl, "UTF-8");
            return "http://localhost:" + getListeningPort() + "/proxy?url=" + encodedUrl + "&bvid=" + bvid;
        } catch (Exception e) {
            return null;
        }
    }
}
