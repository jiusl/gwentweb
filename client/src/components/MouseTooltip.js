import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Box } from '@chakra-ui/react';

/**
 * 跟随鼠标位置的 Tooltip，渲染到 body portal 中
 * 彻底避免 overflow 裁剪和 Grid 布局偏移
 */
export default function MouseTooltip({ children, content, maxW = '220px' }) {
  const [state, setState] = useState({ show: false, x: 0, y: 0 });

  const onEnter = useCallback(() => setState(s => ({ ...s, show: true })), []);
  const onLeave = useCallback(() => setState(s => ({ ...s, show: false })), []);
  const onMove  = useCallback((e) => {
    setState(s => ({ ...s, x: e.clientX + 12, y: e.clientY - 10 }));
  }, []);

  return (
    <>
      <span
        onMouseEnter={onEnter}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={{ display: 'inline-block' }}
      >
        {children}
      </span>
      {state.show && createPortal(
        <Box
          position="fixed"
          left={`${state.x}px`}
          top={`${state.y}px`}
          zIndex={99999}
          bg="linear-gradient(180deg, #2d261d 0%, #221d16 100%)"
          color="#e0d3b8"
          p={2.5}
          borderRadius="3px"
          fontSize="11px"
          lineHeight="1.55"
          maxW={maxW}
          boxShadow="0 6px 24px rgba(0,0,0,0.6), 0 0 0 1px rgba(200,169,110,0.25)"
          border="1px solid rgba(200,169,110,0.3)"
          pointerEvents="none"
          fontFamily="Georgia, 'Times New Roman', serif"
          letterSpacing="0.02em"
        >
          {content}
        </Box>,
        document.body
      )}
    </>
  );
}
