import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type Highlight = {
  title: string;
  caption: string;
  hashtags: string[];
  startSeconds: number;
  endSeconds: number;
  mood: string;
  source: "chapter" | "auto";
  chapterLabel?: string;
};

export type ExtractResult = {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
  durationSeconds: number;
  hasChapters: boolean;
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

type Chapter = { start: number; title: string };

async function fetchWatchPageInfo(
  videoId: string,
): Promise<{ duration: number; chapters: Chapter[]; description: string } | null> {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) return null;
  const html = await res.text();

  // Duration
  const lenMatch =
    html.match(/"lengthSeconds":"(\d+)"/) || html.match(/"approxDurationMs":"(\d+)"/);
  let duration = 0;
  if (lenMatch) {
    const n = parseInt(lenMatch[1], 10);
    duration = lenMatch[0].includes("approxDurationMs") ? Math.round(n / 1000) : n;
  }

  // Description (for fallback chapter parsing & mood context)
  let description = "";
  const descMatch = html.match(/"shortDescription":"((?:\\.|[^"\\])*)"/);
  if (descMatch) {
    try {
      description = JSON.parse(`"${descMatch[1]}"`);
    } catch {
      description = descMatch[1];
    }
  }

  // Chapters from chapter renderer
  const chapters: Chapter[] = [];
  const chapterRe =
    /"chapterRenderer":\{"title":\{"simpleText":"((?:\\.|[^"\\])*)"\},"timeRangeStartMillis":(\d+)/g;
  let cm: RegExpExecArray | null;
  while ((cm = chapterRe.exec(html)) !== null) {
    let title = cm[1];
    try {
      title = JSON.parse(`"${title}"`);
    } catch {
      /* ignore */
    }
    chapters.push({ title, start: Math.round(parseInt(cm[2], 10) / 1000) });
  }

  // Fallback: parse timestamps from description ("0:00 Track name")
  if (chapters.length === 0 && description) {
    const lineRe = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s+(.+)$/gm;
    let lm: RegExpExecArray | null;
    while ((lm = lineRe.exec(description)) !== null) {
      const a = parseInt(lm[1], 10);
      const b = parseInt(lm[2], 10);
      const c = lm[3] ? parseInt(lm[3], 10) : null;
      const start = c !== null ? a * 3600 + b * 60 + c : a * 60 + b;
      chapters.push({ title: lm[4].trim(), start });
    }
  }

  chapters.sort((x, y) => x.start - y.start);
  return { duration, chapters, description };
}

function buildSegments(
  duration: number,
  chapters: Chapter[],
  count: number,
  clipLen: number,
): { start: number; end: number; chapterLabel?: string; source: "chapter" | "auto" }[] {
  if (chapters.length >= 2) {
    return chapters.slice(0, count).map((ch, i) => {
      const nextStart = chapters[i + 1]?.start ?? duration;
      const len = Math.min(clipLen, Math.max(15, nextStart - ch.start - 2));
      // Start a few seconds in so we land on the hook, not the silence
      const start = Math.min(ch.start + 5, Math.max(ch.start, nextStart - len));
      const end = Math.min(start + len, duration);
      return { start, end, chapterLabel: ch.title, source: "chapter" as const };
    });
  }
  // Auto: skip first 15s (intro) and last 15s (outro), distribute evenly
  const usable = Math.max(30, duration - 30);
  const step = usable / count;
  const segs: { start: number; end: number; source: "chapter" | "auto" }[] = [];
  for (let i = 0; i < count; i++) {
    const center = 15 + step * (i + 0.5);
    const start = Math.max(0, Math.floor(center - clipLen / 2));
    const end = Math.min(duration, start + clipLen);
    segs.push({ start, end, source: "auto" });
  }
  return segs;
}

async function generateCaptions(
  videoTitle: string,
  channel: string,
  segments: { start: number; end: number; chapterLabel?: string }[],
) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY가 설정되지 않았습니다.");

  const system = `당신은 연주곡(인스트루멘탈) 음악 숏츠 편집자입니다. 피아노, 재즈, 로파이, 클래식, OST, 어쿠스틱 같은 무가사 음악 클립을 위한 매혹적인 한국어 숏츠 카피를 만듭니다. 감성적이고 분위기 중심의 짧은 표현을 사용하세요.`;

  const segText = segments
    .map((s, i) => {
      const m = Math.floor(s.start / 60);
      const sec = s.start % 60;
      const label = s.chapterLabel ? ` — 챕터: "${s.chapterLabel}"` : "";
      return `클립 ${i + 1}: ${m}:${sec.toString().padStart(2, "0")}부터 ${s.end - s.start}초${label}`;
    })
    .join("\n");

  const user = `곡/영상 제목: ${videoTitle}\n채널: ${channel}\n\n다음 ${segments.length}개 클립 각각에 대해 한국어 숏츠 카피를 작성하세요. 가사가 없는 연주곡임을 기억하세요 — 분위기, 장면, 감정을 환기시키세요.\n\n${segText}`;

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
          name: "submit_captions",
          description: "Return shorts copy for each instrumental clip",
          parameters: {
            type: "object",
            properties: {
              clips: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "감성적인 숏츠 제목 (한국어, 22자 이내, 이모지 1~2개 가능)" },
                    caption: { type: "string", description: "분위기를 살린 1~2문장 캡션 (한국어)" },
                    hashtags: { type: "array", items: { type: "string" }, description: "5~7개 해시태그 (# 제외, 한국어/영어 혼합 가능)" },
                    mood: { type: "string", description: "한 단어로 분위기 (예: 차분함, 몽환적, 에너지틱, 쓸쓸함)" },
                  },
                  required: ["title", "caption", "hashtags", "mood"],
                  additionalProperties: false,
                },
              },
            },
            required: ["clips"],
            additionalProperties: false,
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "submit_captions" } },
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
  const parsed = JSON.parse(args) as {
    clips: { title: string; caption: string; hashtags: string[]; mood: string }[];
  };
  return parsed.clips;
}

export const extractShorts = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        url: z.string().url(),
        count: z.number().int().min(1).max(8).default(4),
        clipLength: z.number().int().min(15).max(60).default(30),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<ExtractResult> => {
    const videoId = parseVideoId(data.url);
    if (!videoId) throw new Error("유효한 유튜브 링크가 아닙니다.");

    const [meta, info] = await Promise.all([fetchOEmbed(videoId), fetchWatchPageInfo(videoId)]);
    if (!info || info.duration < 30) {
      throw new Error("영상 길이를 가져올 수 없습니다. 다른 영상으로 시도해주세요.");
    }

    const segments = buildSegments(info.duration, info.chapters, data.count, data.clipLength);
    const captions = await generateCaptions(meta.title, meta.author_name, segments);

    const highlights: Highlight[] = segments.map((s, i) => {
      const c = captions[i] ?? {
        title: `클립 ${i + 1}`,
        caption: "",
        hashtags: ["music", "shorts"],
        mood: "—",
      };
      return {
        title: c.title,
        caption: c.caption,
        hashtags: c.hashtags,
        startSeconds: s.start,
        endSeconds: s.end,
        mood: c.mood,
        source: s.source,
        chapterLabel: "chapterLabel" in s ? s.chapterLabel : undefined,
      };
    });

    return {
      videoId,
      title: meta.title,
      channel: meta.author_name,
      thumbnail: meta.thumbnail_url,
      durationSeconds: info.duration,
      hasChapters: info.chapters.length >= 2,
      highlights,
    };
  });
