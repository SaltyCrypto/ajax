'use client';

import { useState } from 'react';

interface ShareButtonsProps {
  username: string;
}

export default function ShareButtons({ username }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const profileUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/${username}`;
  const shareText = `My Taste DNA on Ajax — YouTube Astrology. What's yours?`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareToTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(profileUrl)}`;
    window.open(url, '_blank', 'width=550,height=420');
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Taste DNA — Ajax',
          text: shareText,
          url: profileUrl,
        });
      } catch {
        // User cancelled or share failed
      }
    } else {
      copyLink();
    }
  };

  return (
    <div className="flex items-center justify-center gap-3 flex-wrap">
      <button onClick={shareNative} className="btn-primary text-sm">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        Share
      </button>

      <button onClick={shareToTwitter} className="btn-secondary text-sm">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        Twitter
      </button>

      <button onClick={copyLink} className="btn-secondary text-sm">
        {copied ? (
          <>
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Copied!
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Copy Link
          </>
        )}
      </button>
    </div>
  );
}
