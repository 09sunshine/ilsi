import React, { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  RotateCcw,
  RotateCw,
  ExternalLink,
  AlertCircle,
  Video as VideoIcon,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface LessonVideoPlayerProps {
  url: string | null | undefined;
  title?: string;
  poster?: string;
  onProgress?: (percent: number) => void;
  onEnded?: () => void;
  className?: string;
}

type VideoType = "youtube" | "vimeo" | "loom" | "direct" | "unknown";

function parseVideoSource(url: string | null | undefined): { type: VideoType; embedUrl?: string; rawUrl?: string } {
  if (!url || typeof url !== "string") {
    return { type: "unknown" };
  }

  const trimmed = url.trim();

  // YouTube detection
  const ytMatch = trimmed.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i
  );
  if (ytMatch && ytMatch[1]) {
    return {
      type: "youtube",
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?rel=0&modestbranding=1&enablejsapi=1`,
      rawUrl: trimmed,
    };
  }

  // Vimeo detection
  const vimeoMatch = trimmed.match(/(?:vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/[^\/]*\/videos\/|album\/(?:\d+\/)?video\/|video\/|)(\d+))/i);
  if (vimeoMatch && vimeoMatch[1]) {
    return {
      type: "vimeo",
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}?dnt=1&title=0&byline=0`,
      rawUrl: trimmed,
    };
  }

  // Loom detection
  const loomMatch = trimmed.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/i);
  if (loomMatch && loomMatch[1]) {
    return {
      type: "loom",
      embedUrl: `https://www.loom.com/embed/${loomMatch[1]}`,
      rawUrl: trimmed,
    };
  }

  // Direct video (mp4, webm, mov, Supabase signed URL or public URL)
  return {
    type: "direct",
    rawUrl: trimmed,
  };
}

export function LessonVideoPlayer({
  url,
  title,
  poster,
  onProgress,
  onEnded,
  className,
}: LessonVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastReportedPercent, setLastReportedPercent] = useState(0);

  const source = parseVideoSource(url);

  // Reset states on URL change
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setHasError(false);
    setIsLoading(true);
    setLastReportedPercent(0);
  }, [url]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  if (!url) {
    return (
      <div className={cn("aspect-video w-full rounded-xl border border-dashed border-border bg-muted/20 flex flex-col items-center justify-center p-6 text-center text-muted-foreground", className)}>
        <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <VideoIcon className="size-6 text-muted-foreground/60" />
        </div>
        <p className="font-medium text-sm text-foreground">No Video Attached</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          A video has not been uploaded or linked for this lesson yet.
        </p>
      </div>
    );
  }

  // Embeddable player (YouTube, Vimeo, Loom)
  if (source.type === "youtube" || source.type === "vimeo" || source.type === "loom") {
    return (
      <div className={cn("relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-black shadow-md", className)}>
        <iframe
          src={source.embedUrl}
          title={title || "Lesson Video"}
          className="absolute inset-0 h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  // Direct HTML5 video player (Supabase Storage or direct MP4/WebM)
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => setHasError(true));
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    const dur = videoRef.current.duration || 0;
    setCurrentTime(curr);

    if (dur > 0 && onProgress) {
      const percent = Math.round((curr / dur) * 100);
      // Report progression at 5% intervals to prevent excessive network calls
      if (percent >= lastReportedPercent + 5 || percent === 100) {
        setLastReportedPercent(percent);
        onProgress(percent);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const seekTo = (Number(e.target.value) / 100) * (duration || 0);
    videoRef.current.currentTime = seekTo;
    setCurrentTime(seekTo);
  };

  const handleSkip = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.min(Math.max(0, videoRef.current.currentTime + seconds), duration || 0);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const val = Number(e.target.value);
    videoRef.current.volume = val;
    setVolume(val);
    if (val === 0) {
      videoRef.current.muted = true;
      setIsMuted(true);
    } else if (isMuted) {
      videoRef.current.muted = false;
      setIsMuted(false);
    }
  };

  const changePlaybackRate = (rate: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={cn(
        "group relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-black shadow-lg select-none",
        className
      )}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={source.rawUrl}
        poster={poster}
        playsInline
        className="h-full w-full object-contain cursor-pointer"
        onClick={togglePlay}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => {
          setIsLoading(false);
          if (videoRef.current) {
            setDuration(videoRef.current.duration || 0);
          }
        }}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => setIsLoading(false)}
        onEnded={() => {
          setIsPlaying(false);
          if (onEnded) onEnded();
        }}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
      >
        <track kind="captions" />
      </video>

      {/* Loading Spinner Overlay */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
          <Loader2 className="size-10 animate-spin text-white/80" />
        </div>
      )}

      {/* Error Overlay with External Fallback */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 p-6 text-center text-white">
          <AlertCircle className="size-10 text-destructive mb-2" />
          <p className="font-semibold text-sm">Playback Error</p>
          <p className="text-xs text-zinc-300 mt-1 max-w-sm">
            Could not play this video format directly in the browser. You can try opening it directly in a new tab.
          </p>
          {source.rawUrl && (
            <Button asChild size="sm" variant="outline" className="mt-4 gap-1.5 text-xs text-white border-white/20 bg-white/10 hover:bg-white/20">
              <a href={source.rawUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5" />
                Open Video in New Tab
              </a>
            </Button>
          )}
        </div>
      )}

      {/* Center Big Play Button (When Paused) */}
      {!isPlaying && !isLoading && !hasError && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity cursor-pointer group-hover:bg-black/40"
        >
          <div className="size-16 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center shadow-xl transition-transform transform group-hover:scale-110 hover:bg-primary">
            <Play className="size-8 ml-1 fill-current" />
          </div>
        </div>
      )}

      {/* Custom Bottom Control Bar */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 pt-6 transition-opacity opacity-0 group-hover:opacity-100 flex flex-col gap-2">
        {/* Seek Bar */}
        <div className="relative flex items-center group/seek">
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={progressPercent || 0}
            onChange={handleSeek}
            className="w-full h-1.5 bg-white/30 rounded-lg appearance-none cursor-pointer accent-primary hover:h-2.5 transition-all"
          />
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between text-white text-xs">
          <div className="flex items-center gap-2">
            {/* Play/Pause */}
            <button
              type="button"
              onClick={togglePlay}
              className="p-1 rounded hover:bg-white/20 transition"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 fill-current" />}
            </button>

            {/* Skip Back / Forward */}
            <button
              type="button"
              onClick={() => handleSkip(-10)}
              className="p-1 rounded hover:bg-white/20 transition hidden sm:inline-flex"
              title="Rewind 10s"
            >
              <RotateCcw className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleSkip(10)}
              className="p-1 rounded hover:bg-white/20 transition hidden sm:inline-flex"
              title="Fast Forward 10s"
            >
              <RotateCw className="size-3.5" />
            </button>

            {/* Volume */}
            <div className="flex items-center gap-1.5 ml-1">
              <button
                type="button"
                onClick={toggleMute}
                className="p-1 rounded hover:bg-white/20 transition"
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-14 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-primary hidden sm:inline-block"
              />
            </div>

            {/* Time Stamp */}
            <span className="font-mono text-[11px] text-zinc-300 ml-2">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right Controls: Speed & Fullscreen */}
          <div className="flex items-center gap-2">
            {/* Playback speed selector */}
            <div className="flex items-center gap-1 bg-white/10 rounded px-1.5 py-0.5 text-[10px] font-mono">
              {[1, 1.25, 1.5, 2].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => changePlaybackRate(rate)}
                  className={cn(
                    "px-1 py-0.5 rounded transition",
                    playbackRate === rate ? "bg-primary text-primary-foreground font-bold" : "text-zinc-300 hover:text-white"
                  )}
                >
                  {rate}x
                </button>
              ))}
            </div>

            {/* Fullscreen toggle */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1 rounded hover:bg-white/20 transition"
              aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
