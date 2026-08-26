import React from 'react';
import HostelCareLoader from '../HostelCareLoader';

/**
 * FuturisticLoader - Backward-compatible wrapper delegating to HostelCareLoader.
 * Renders the nostalgic Windows XP dog assistant with a bone.
 */
export default function FuturisticLoader({
  size = 'sm',
  className = '',
  message = '',
}) {
  return (
    <HostelCareLoader
      size={size}
      inline={size === 'sm' || size === 'xs'}
      message={message}
      className={className}
    />
  );
}
