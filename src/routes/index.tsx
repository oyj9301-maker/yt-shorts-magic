import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast, Toaster } from "sonner";
import { Loader2, Sparkles, Youtube, Copy, Play, Clock, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { extractShorts, type ExtractResult } from "@/lib/extract-shorts";

export const Route = createFileRoute("/")({ component: Index });

function fmt(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function Index() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<ExtractResult | null>(null);

  const mut = useMutation({
    mutationFn: (u: string) => extractShorts({ data: { url: u } }),
    onSuccess: (d) => {
      setResult(d);
      toast.success(`${d.highlights.length}개의 숏츠 하이라이트를 찾았어요!`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setResult(null);
    mut.mutate(url.trim());
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <Toaster richColors position="top-center" />

      {/* Decorative red gradient */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-gradient-to-b from-red-50 via-red-50/40 to-transparent" />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 text-white shadow-lg shadow-red-600/30">
            <Scissors className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight">ShortsCut</span>
        </div>
        <Badge variant="outline" className="border-red-200 bg-white text-red-700">
          <Sparkles className="mr-1 h-3 w-3" /> AI Powered
        </Badge>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 pb-24">
        {/* Hero */}
        <section className="pt-12 pb-10 text-center">
          <Badge className="mb-5 bg-red-600 hover:bg-red-600">YouTube → Shorts</Badge>
          <h1 className="mx-auto max-w-3xl text-5xl font-bold leading-tight tracking-tight md:text-6xl">
            긴 유튜브 영상을 <span className="text-red-600">바이럴 숏츠</span>로
            <br /> 한 번에 추출하세요
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-neutral-600">
            AI가 자막을 분석해 가장 임팩트 있는 15~60초 하이라이트 구간을 자동으로 골라줍니다.
            제목, 캡션, 해시태그까지.
          </p>
        </section>

        {/* Input */}
        <form onSubmit={onSubmit} className="mx-auto max-w-2xl">
          <div className="flex flex-col gap-2 rounded-2xl border border-red-100 bg-white p-2 shadow-xl shadow-red-600/5 sm:flex-row">
            <div className="flex flex-1 items-center gap-2 px-3">
              <Youtube className="h-5 w-5 shrink-0 text-red-600" />
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
                  <Sparkles className="mr-2 h-4 w-4" /> 숏츠 만들기
                </>
              )}
            </Button>
          </div>
          <p className="mt-3 text-center text-xs text-neutral-500">
            자막이 있는 공개 영상에서 가장 잘 작동해요
          </p>
        </form>

        {/* Loading state */}
        {mut.isPending && (
          <div className="mx-auto mt-16 max-w-md text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
              <Loader2 className="h-7 w-7 animate-spin text-red-600" />
            </div>
            <p className="text-sm font-medium">자막을 가져오고 AI가 하이라이트를 골라내는 중...</p>
            <p className="mt-1 text-xs text-neutral-500">최대 30초 정도 걸려요</p>
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
                  원본 영상
                </p>
                <h2 className="mt-1 truncate text-lg font-bold">{result.title}</h2>
                <p className="text-sm text-neutral-500">{result.channel}</p>
              </div>
            </div>

            <div className="mb-6 flex items-end justify-between">
              <div>
                <h3 className="text-2xl font-bold">추천 숏츠 {result.highlights.length}개</h3>
                <p className="text-sm text-neutral-500">
                  각 클립을 미리 보고 캡션을 복사하세요
                </p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {result.highlights.map((h, i) => (
                <HighlightCard key={i} videoId={result.videoId} index={i + 1} h={h} />
              ))}
            </div>
          </section>
        )}

        {/* Empty state features */}
        {!result && !mut.isPending && (
          <section className="mx-auto mt-20 grid max-w-4xl gap-6 sm:grid-cols-3">
            {[
              { icon: Sparkles, title: "AI 하이라이트", desc: "자막을 분석해 가장 임팩트 있는 구간을 자동 선택" },
              { icon: Clock, title: "정확한 타임스탬프", desc: "15~60초 길이로 시작/종료 시간 제공" },
              { icon: Copy, title: "캡션 + 해시태그", desc: "바로 업로드 가능한 제목과 해시태그 생성" },
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
  h: ExtractResult["highlights"][number];
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
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />
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
            <div className="absolute bottom-3 left-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-mono font-medium text-neutral-900">
              {fmt(start)} – {fmt(end)}
            </div>
          </button>
        )}
      </div>

      <div className="space-y-3 p-4">
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
        <div className="rounded-lg bg-neutral-50 p-2.5 text-xs text-neutral-600">
          <span className="font-semibold text-neutral-900">왜 바이럴? </span>
          {h.reason}
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
