import React from 'react';
import HostelCareLoader from '../HostelCareLoader';

/**
 * FuturisticLoader - Backward-compatible wrapper delegating to HostelCareLoader.
 * Renders the nostalgic Windows XP dog assistant with a bone in button / inline mode.
 */
export default function FuturisticLoader({
  size = 'sm',
  className = '',
  message = 'Authenticating…',
}) {
  return (
    <HostelCareLoader
      size={size}
      inline={true}
      message={message}
      className={className}
    />
  );
}
