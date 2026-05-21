import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast, Toaster } from "sonner";
import {
  Loader2,
  Sparkles,
  Music,
  Copy,
  Play,
  Clock,
  Scissors,
  ListMusic,
  Disc3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { extractShorts, type ExtractResult, type Highlight } from "@/lib/extract-shorts";

export const Route = createFileRoute("/")({ component: Index });

function fmt(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function Index() {
  const [url, setUrl] = useState("");
  const [count, setCount] = useState(4);
  const [clipLength, setClipLength] = useState(30);
  const [result, setResult] = useState<ExtractResult | null>(null);

  const mut = useMutation({
    mutationFn: () => extractShorts({ data: { url: url.trim(), count, clipLength } }),
    onSuccess: (d) => {
      setResult(d);
      toast.success(
        d.hasChapters
          ? `챕터 ${d.highlights.length}개를 숏츠로 변환했어요`
          : `${d.highlights.length}개의 음악 하이라이트를 만들었어요`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setResult(null);
    mut.mutate();
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-neutral-900">
      <Toaster richColors position="top-center" />

      {/* Decorative */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-to-b from-red-50 via-red-50/30 to-transparent" />
      <div className="pointer-events-none absolute -right-32 top-32 h-96 w-96 rounded-full bg-red-100/40 blur-3xl" />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 text-white shadow-lg shadow-red-600/30">
            <Disc3 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-bold leading-none tracking-tight">ShortsCut</div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-red-600">
              For Instrumental Channels
            </div>
          </div>
        </div>
        <Badge variant="outline" className="border-red-200 bg-white text-red-700">
          <Sparkles className="mr-1 h-3 w-3" /> AI Powered
        </Badge>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 pb-24">
        {/* Hero */}
        <section className="pt-10 pb-8 text-center">
          <Badge className="mb-5 bg-red-600 hover:bg-red-600">
            <Music className="mr-1 h-3 w-3" /> 연주곡 전용
          </Badge>
          <h1 className="mx-auto max-w-3xl text-5xl font-bold leading-tight tracking-tight md:text-6xl">
            긴 연주 영상을 <span className="text-red-600">감성 숏츠</span>로
            <br /> 한 번에 잘라드려요
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-neutral-600">
            피아노 · 재즈 · 로파이 · OST · 클래식 — 챕터가 있으면 트랙별로,
            없으면 영상 전체에서 균등하게 하이라이트를 뽑아 한국어 캡션까지 만들어줍니다.
          </p>
        </section>

        {/* Input + Controls */}
        <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-3">
          <div className="flex flex-col gap-2 rounded-2xl border border-red-100 bg-white p-2 shadow-xl shadow-red-600/5 sm:flex-row">
            <div className="flex flex-1 items-center gap-2 px-3">
              <ListMusic className="h-5 w-5 shrink-0 text-red-600" />
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="border-0 shadow-none focus-visible:ring-0"
                disabled={mut.isPending}
              />
            </div>
            <Button
              type="submit"
              disabled={mut.isPending || !url.trim()}
              className="h-12 bg-red-600 px-6 text-white hover:bg-red-700"
            >
              {mut.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 분석 중...
                </>
              ) : (
                <>
                  <Scissors className="mr-2 h-4 w-4" /> 숏츠 만들기
                </>
              )}
            </Button>
          </div>

          <div className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-5 sm:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">클립 개수</span>
                <span className="font-mono text-red-600">{count}개</span>
              </div>
              <Slider
                value={[count]}
                onValueChange={(v) => setCount(v[0])}
                min={1}
                max={8}
                step={1}
                disabled={mut.isPending}
              />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">클립 길이</span>
                <span className="font-mono text-red-600">{clipLength}초</span>
              </div>
              <Slider
                value={[clipLength]}
                onValueChange={(v) => setClipLength(v[0])}
                min={15}
                max={60}
                step={5}
                disabled={mut.isPending}
              />
            </div>
          </div>
          <p className="text-center text-xs text-neutral-500">
            챕터(타임스탬프)가 있는 영상에서 가장 정확하게 작동해요
          </p>
        </form>

        {/* Loading */}
        {mut.isPending && (
          <div className="mx-auto mt-16 max-w-md text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
              <Loader2 className="h-7 w-7 animate-spin text-red-600" />
            </div>
            <p className="text-sm font-medium">트랙 정보를 가져오고 AI가 카피를 쓰는 중...</p>
          </div>
        )}

        {/* Results */}
        {result && !mut.isPending && (
          <section className="mt-16">
            <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5 sm:flex-row sm:items-center">
              <img
                src={result.thumbnail}
                alt=""
                className="h-24 w-40 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-red-600">
                  원본 영상 · {fmt(result.durationSeconds)}
                </p>
                <h2 className="mt-1 truncate text-lg font-bold">{result.title}</h2>
                <p className="text-sm text-neutral-500">{result.channel}</p>
              </div>
              <Badge
                variant="outline"
                className={
                  result.hasChapters
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-neutral-200 text-neutral-600"
                }
              >
                {result.hasChapters ? "챕터 기반" : "자동 분할"}
              </Badge>
            </div>

            <div className="mb-6">
              <h3 className="text-2xl font-bold">추천 숏츠 {result.highlights.length}개</h3>
              <p className="text-sm text-neutral-500">
                각 클립을 미리 듣고 캡션을 복사하세요
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {result.highlights.map((h, i) => (
                <HighlightCard key={i} videoId={result.videoId} index={i + 1} h={h} />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {!result && !mut.isPending && (
          <section className="mx-auto mt-20 grid max-w-4xl gap-6 sm:grid-cols-3">
            {[
              { icon: ListMusic, title: "챕터 자동 인식", desc: "트랙별 타임스탬프가 있으면 트랙마다 1개 숏츠 생성" },
              { icon: Disc3, title: "스마트 분할", desc: "챕터 없는 영상도 인트로/아웃트로 제외해 균등 추출" },
              { icon: Sparkles, title: "감성 한국어 카피", desc: "분위기에 맞춘 제목·캡션·해시태그 자동 생성" },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl border border-neutral-200 bg-white p-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
                  <f.icon className="h-5 w-5" />
                </div>
                <h4 className="font-semibold">{f.title}</h4>
                <p className="mt-1 text-sm text-neutral-500">{f.desc}</p>
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

function HighlightCard({
  videoId,
  index,
  h,
}: {
  videoId: string;
  index: number;
  h: Highlight;
}) {
  const [playing, setPlaying] = useState(false);
  const start = Math.floor(h.startSeconds);
  const end = Math.floor(h.endSeconds);
  const dur = end - start;
  const embedUrl = `https://www.youtube.com/embed/${videoId}?start=${start}&end=${end}&autoplay=1&rel=0`;
  const thumb = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  const copyAll = () => {
    const text = `${h.title}\n\n${h.caption}\n\n${h.hashtags.map((t) => `#${t}`).join(" ")}`;
    navigator.clipboard.writeText(text);
    toast.success("캡션이 복사되었어요");
  };

  return (
    <Card className="group overflow-hidden border-neutral-200 p-0 transition-shadow hover:shadow-xl hover:shadow-red-600/10">
      <div className="relative aspect-[9/16] w-full overflow-hidden bg-neutral-900">
        {playing ? (
          <iframe
            src={embedUrl}
            className="h-full w-full"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        ) : (
          <button
            onClick={() => setPlaying(true)}
            className="group/play relative h-full w-full"
            aria-label="재생"
          >
            <img src={thumb} alt="" className="h-full w-full object-cover opacity-80" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/40" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white shadow-2xl transition-transform group-hover/play:scale-110">
                <Play className="ml-1 h-7 w-7 fill-current" />
              </div>
            </div>
            <div className="absolute left-3 top-3 rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold text-white">
              #{index}
            </div>
            <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
              <Clock className="h-3 w-3" /> {dur}s
            </div>
            <div className="absolute bottom-3 left-3 rounded-full bg-white/95 px-2.5 py-1 font-mono text-xs font-medium text-neutral-900">
              {fmt(start)} – {fmt(end)}
            </div>
          </button>
        )}
      </div>

      <div className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
            {h.mood}
          </span>
          {h.source === "chapter" && h.chapterLabel && (
            <span className="truncate rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
              {h.chapterLabel}
            </span>
          )}
        </div>
        <h4 className="line-clamp-2 text-base font-bold leading-snug">{h.title}</h4>
        <p className="line-clamp-3 text-sm text-neutral-600">{h.caption}</p>
        <div className="flex flex-wrap gap-1.5">
          {h.hashtags.slice(0, 5).map((t) => (
            <span
              key={t}
              className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"
            >
              #{t}
            </span>
          ))}
        </div>
        <Button
          onClick={copyAll}
          variant="outline"
          className="w-full border-red-200 text-red-700 hover:bg-red-50 hover:text-red-700"
        >
          <Copy className="mr-2 h-4 w-4" /> 캡션 복사
        </Button>
      </div>
    </Card>
  );
}
