import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type Highlight = {
  title: string;
  caption: string;
  hashtags: string[];
  startSeconds: number;
  endSeconds: number;
  reason: string;
};

export type ExtractResult = {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
  durationHint?: number;
  highlights: Highlight[];
};

function parseVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split("/")[0] || null;
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const m = u.pathname.match(/\/(shorts|embed|live)\/([^/?]+)/);
    if (m) return m[2];
    return null;
  } catch {
    return null;
  }
}

async function fetchOEmbed(videoId: string) {
  const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("동영상 정보를 가져올 수 없습니다. 공개된 영상인지 확인해주세요.");
  return (await r.json()) as { title: string; author_name: string; thumbnail_url: string };
}

async function fetchTranscript(videoId: string): Promise<{ text: string; segments: { t: number; d: number; text: string }[] } | null> {
  // Fetch watch page and parse captionTracks
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}&hl=en`;
  const res = await fetch(watchUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9,ko;q=0.8",
    },
  });
  if (!res.ok) return null;
  const html = await res.text();
  const m = html.match(/"captionTracks":(\[.*?\])/);
  if (!m) return null;
  let tracks: Array<{ baseUrl: string; languageCode: string; kind?: string }>;
  try {
    tracks = JSON.parse(m[1]);
  } catch {
    return null;
  }
  if (!tracks.length) return null;
  const pick =
    tracks.find((t) => t.languageCode === "ko") ||
    tracks.find((t) => t.languageCode === "en") ||
    tracks[0];
  const captionUrl = pick.baseUrl.replace(/\\u0026/g, "&");
  const xr = await fetch(captionUrl);
  if (!xr.ok) return null;
  const xml = await xr.text();
  const segments: { t: number; d: number; text: string }[] = [];
  const re = /<text start="([\d.]+)"(?: dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(xml)) !== null) {
    const t = parseFloat(mm[1]);
    const d = parseFloat(mm[2] || "0");
    const text = mm[3]
      .replace(/&amp;/g, "&")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text) segments.push({ t, d, text });
  }
  if (!segments.length) return null;
  // Build text with timestamps for the model
  const text = segments.map((s) => `[${Math.floor(s.t)}s] ${s.text}`).join("\n");
  return { text, segments };
}

async function callAI(transcript: string, title: string) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY가 설정되지 않았습니다.");

  const system = `당신은 유튜브 숏츠 편집 전문가입니다. 긴 영상의 자막에서 가장 바이럴 가능성이 높은 15~60초 분량 하이라이트 구간을 3~5개 골라냅니다. 각 클립은 단독으로 이해 가능해야 하고, 강한 훅으로 시작해야 합니다.`;

  const user = `영상 제목: ${title}\n\n자막 (타임스탬프 단위 초):\n${transcript.slice(0, 15000)}`;

  const body = {
    model: "google/gemini-3-flash-preview",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "submit_highlights",
          description: "Return shorts-worthy highlight clips",
          parameters: {
            type: "object",
            properties: {
              highlights: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "강한 훅이 있는 숏츠 제목 (한국어, 25자 이내)" },
                    caption: { type: "string", description: "숏츠 설명 캡션 (한국어, 1~2문장)" },
                    hashtags: { type: "array", items: { type: "string" }, description: "3~6개 해시태그 (# 제외)" },
                    startSeconds: { type: "number" },
                    endSeconds: { type: "number" },
                    reason: { type: "string", description: "왜 바이럴 가능성이 높은지 (한국어, 1문장)" },
                  },
                  required: ["title", "caption", "hashtags", "startSeconds", "endSeconds", "reason"],
                  additionalProperties: false,
                },
              },
            },
            required: ["highlights"],
            additionalProperties: false,
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "submit_highlights" } },
  };

  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (r.status === 429) throw new Error("요청이 너무 많습니다. 잠시 후 다시 시도해주세요.");
  if (r.status === 402) throw new Error("AI 크레딧이 부족합니다. 워크스페이스 사용량 페이지에서 충전해주세요.");
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`AI 호출 실패: ${r.status} ${t.slice(0, 200)}`);
  }
  const data = await r.json();
  const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("AI 응답을 파싱할 수 없습니다.");
  const parsed = JSON.parse(args) as { highlights: Highlight[] };
  return parsed.highlights;
}

export const extractShorts = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ url: z.string().url() }).parse(d))
  .handler(async ({ data }): Promise<ExtractResult> => {
    const videoId = parseVideoId(data.url);
    if (!videoId) throw new Error("유효한 유튜브 링크가 아닙니다.");

    const meta = await fetchOEmbed(videoId);
    const transcript = await fetchTranscript(videoId);
    if (!transcript) {
      throw new Error(
        "이 영상의 자막을 가져올 수 없습니다. 자동 자막이 비활성화되어 있거나 비공개일 수 있어요. 다른 영상으로 시도해주세요.",
      );
    }
    const highlights = await callAI(transcript.text, meta.title);
    return {
      videoId,
      title: meta.title,
      channel: meta.author_name,
      thumbnail: meta.thumbnail_url,
      highlights,
    };
  });
