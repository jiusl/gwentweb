// Mock @chakra-ui/react — 返回原生 HTML 元素包装器，用于测试
import React from 'react';

function createMockElement(defaultTag, baseProps = {}) {
  return React.forwardRef(({ children, isDisabled, onClick, as, ...props }, ref) => {
    const tag = as || defaultTag;
    const allProps = { ...baseProps, ...props, ref };
    if (isDisabled !== undefined) allProps.disabled = isDisabled;
    if (onClick && !allProps.disabled) allProps.onClick = onClick;
    // 过滤 Chakra 特有样式属性，避免 React DOM 警告
    const cleanProps = {};
    const styleProps = new Set([
      'textTransform', 'borderRadius', 'isTruncated', 'maxW', 'minH',
      'templateColumns', 'borderTop', 'textAlign', 'lineHeight', 'noOfLines',
      'backdropFilter', 'flexDirection', 'alignItems', 'justifyContent',
      'borderColor', 'letterSpacing', 'gap', 'mb', 'mt', 'mr', 'ml', 'mx', 'my',
      'pb', 'pt', 'pr', 'pl', 'px', 'py', 'w', 'h', 'minW', 'maxH', 'bg',
      'fontSize', 'fontWeight', 'color', 'opacity', 'cursor', 'position',
      'transform', 'transition', 'boxShadow', 'display', 'border', 'borderWidth',
      'bgColor', 'flexWrap', 'flex', 'px', 'h', 'w',
    ]);
    for (const [key, value] of Object.entries(allProps)) {
      if (!styleProps.has(key)) {
        cleanProps[key] = value;
      }
    }
    return React.createElement(tag, cleanProps, children);
  });
}

export const Box = createMockElement('div');
export const Button = createMockElement('button', { type: 'button' });
export const Flex = createMockElement('div');
export const Text = createMockElement('span');
export const Grid = createMockElement('div');
export const HStack = createMockElement('div');
export const VStack = createMockElement('div');
export const Heading = createMockElement('h2');
export const Badge = createMockElement('span');
export const Container = createMockElement('div');
export const Spinner = createMockElement('div');

export const ChakraProvider = ({ children }) => children;
