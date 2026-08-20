import YouTube, { type YouTubeEvent, type YouTubePlayer } from 'react-youtube'

type PlayerProps = {
  videoId: string
  onReady: (player: YouTubePlayer) => void
}

export function Player({ videoId, onReady }: PlayerProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-black shadow-xl shadow-black/40">
      <div className="aspect-video w-full">
        <YouTube
          key={videoId}
          videoId={videoId}
          className="h-full w-full"
          iframeClassName="h-full w-full"
          opts={{
            width: '100%',
            height: '100%',
            playerVars: {
              autoplay: 0,
              controls: 1,
              rel: 0,
              modestbranding: 1,
              playsinline: 1,
              cc_load_policy: 0,
            },
          }}
          onReady={(event: YouTubeEvent) => onReady(event.target)}
        />
      </div>
    </div>
  )
}
