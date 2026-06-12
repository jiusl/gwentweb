import React from 'react';
import {
  Box, VStack, HStack, Text, Badge,
  AvatarRoot, AvatarFallback,
  DialogRoot, DialogBackdrop, DialogPositioner, DialogContent,
  DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogCloseTrigger
} from '@chakra-ui/react';

// 获取名字首字符（跳过 emoji）
const getInitial = (name) => {
  if (!name) return '?';
  // 如果以 emoji 开头，跳过前几个字符
  const cleaned = name.replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FEFF}]/gu, '').trim();
  return cleaned[0] || name[0] || '?';
};

export default function PlayerList({
  playerList, myId, playerName,
  onInvite, waitingForResponse, inviteResponse, incomingInvite,
  onAcceptInvite, onRejectInvite, onStartMatch, onCancelInvite,
  deck, leader
}) {
  const others = playerList.filter(p => p.id !== myId);

  return (
    <Box h="100%" display="flex" flexDirection="column">
      <Text fontWeight="bold" fontSize="lg" mb={3} fontFamily="Georgia, serif" color="#e0d3b8" letterSpacing="0.04em">
        🎮 在线玩家 ({others.length})
      </Text>

      {/* 我的状态 */}
      <HStack p={2} bg="rgba(34,29,22,0.8)" borderRadius="3px" mb={3} border="1px solid rgba(200,169,110,0.1)">
        <AvatarRoot size="sm">
          <AvatarFallback bg="#3d2e1f" color="#d4b87a" fontFamily="Georgia, serif">{getInitial(playerName)}</AvatarFallback>
        </AvatarRoot>
        <Text fontSize="sm" color="#e0d3b8" fontFamily="Georgia, serif">{playerName}（我）</Text>
      </HStack>

      <Box mb={3} className="ornament-divider" />

      {/* 玩家列表 */}
      <VStack gap={2} flex="1" overflowY="auto">
        {others.map(player => {
          const isAI = player.isAI;
          const isPlaying = player.status === 'playing';
          const isPending = player.status === 'pending';

          return (
            <HStack
              key={player.id}
              p={3} bg="rgba(34,29,22,0.8)" borderRadius="3px" border="1px solid rgba(200,169,110,0.08)"
              w="100%" justify="space-between"
            >
              <HStack>
                <AvatarRoot size="sm">
                  <AvatarFallback bg={isAI ? '#3d2e1f' : '#2d261d'} color={isAI ? '#d4b87a' : '#baaa8a'} fontFamily="Georgia, serif">
                    {getInitial(player.name)}
                  </AvatarFallback>
                </AvatarRoot>
                <Box>
                  <Text fontSize="sm" fontWeight="bold" color="#e0d3b8" fontFamily="Georgia, serif">{player.name}</Text>
                  <Badge bg={isAI ? 'rgba(200,169,110,0.15)' : isPlaying ? 'rgba(107,138,58,0.15)' : isPending ? 'rgba(200,169,110,0.1)' : 'rgba(186,170,138,0.1)'}
                    color={isAI ? '#d4b87a' : isPlaying ? '#6b8a3a' : isPending ? '#baaa8a' : '#8a7a5a'}
                    fontSize="2xs" borderRadius="2px" fontFamily="Georgia, serif">
                    {isAI ? '🤖 AI' : isPlaying ? '对战中' : isPending ? '等待中' : '在线'}
                  </Badge>
                </Box>
              </HStack>
              <Box as="button" onClick={() => onInvite(player.id)}
                disabled={isPlaying || isPending || waitingForResponse}
                size="sm" px={3} py={1.5} borderRadius="3px"
                bg={isAI ? 'rgba(200,169,110,0.12)' : 'rgba(107,138,58,0.1)'}
                color={isAI ? '#d4b87a' : '#6b8a3a'}
                border="1px solid" borderColor={isAI ? 'rgba(200,169,110,0.25)' : 'rgba(107,138,58,0.2)'}
                fontWeight="600" fontSize="12px" fontFamily="Georgia, serif" letterSpacing="0.04em"
                cursor={(isPlaying || isPending || waitingForResponse) ? 'default' : 'pointer'}
                opacity={(isPlaying || isPending || waitingForResponse) ? 0.4 : 1}
                transition="all 0.2s"
                _hover={!(isPlaying || isPending || waitingForResponse) ? { bg: isAI ? 'rgba(200,169,110,0.2)' : 'rgba(107,138,58,0.18)', borderColor: isAI ? 'rgba(200,169,110,0.4)' : 'rgba(107,138,58,0.35)' } : {}}
              >
                {waitingForResponse ? '等待中...' : '邀请对战'}
              </Box>
            </HStack>
          );
        })}
        {others.length === 0 && (
          <Text color="#8a7a5a" fontSize="sm" fontFamily="Georgia, serif">暂无其他玩家在线</Text>
        )}
      </VStack>

      {/* 收到邀请弹窗 — 始终渲染，用 open 控制 */}
      <DialogRoot open={!!incomingInvite} onOpenChange={(e) => { if (!e.open && incomingInvite) onRejectInvite(incomingInvite.inviteId); }}>
        <DialogBackdrop />
        <DialogPositioner>
          <DialogContent bg="#221d16" border="1px solid rgba(200,169,110,0.2)" borderRadius="3px">
            <DialogHeader>
              <DialogTitle fontFamily="Georgia, serif" color="#e0d3b8">📨 对战邀请</DialogTitle>
              <DialogCloseTrigger />
            </DialogHeader>
            <DialogBody>
              {incomingInvite && (
                <Text color="#e0d3b8" fontFamily="Georgia, serif">
                  <Text as="span" fontWeight="bold" color="#d4b87a" fontFamily="Georgia, serif">{incomingInvite.fromName}</Text>
                  {' '}邀请你对战！
                </Text>
              )}
            </DialogBody>
            <DialogFooter>
              <Box as="button" mr={3} px={4} py={2} borderRadius="3px"
                bg="rgba(181,52,58,0.1)" color="#b5343a" border="1px solid rgba(181,52,58,0.25)"
                fontFamily="Georgia, serif" fontWeight="600" cursor="pointer"
                _hover={{ bg: 'rgba(181,52,58,0.2)' }} transition="all 0.2s"
                onClick={() => incomingInvite && onRejectInvite(incomingInvite.inviteId)}>
                拒绝
              </Box>
              <Box as="button" px={4} py={2} borderRadius="3px"
                bg="rgba(107,138,58,0.15)" color="#6b8a3a" border="1px solid rgba(107,138,58,0.3)"
                fontFamily="Georgia, serif" fontWeight="600" cursor="pointer"
                _hover={{ bg: 'rgba(107,138,58,0.25)' }} transition="all 0.2s"
                onClick={() => incomingInvite && onAcceptInvite(incomingInvite.inviteId)}>
                接受
              </Box>
            </DialogFooter>
          </DialogContent>
        </DialogPositioner>
      </DialogRoot>

      {/* 邀请回复弹窗 — 始终渲染，用 open 控制 */}
      <DialogRoot open={!!inviteResponse} onOpenChange={(e) => { if (!e.open) onCancelInvite(); }}>
        <DialogBackdrop />
        <DialogPositioner>
          <DialogContent bg="#221d16" border="1px solid rgba(200,169,110,0.2)" borderRadius="3px">
            <DialogHeader>
              <DialogTitle fontFamily="Georgia, serif" color="#e0d3b8">
                {inviteResponse?.accepted ? '✅ 对方接受了邀请!' : '❌ 对方拒绝了邀请'}
              </DialogTitle>
              <DialogCloseTrigger />
            </DialogHeader>
            <DialogBody>
              {inviteResponse && (
                <Text fontSize="lg" color="#e0d3b8" fontFamily="Georgia, serif">
                  {inviteResponse.fromName}
                  {inviteResponse.accepted ? ' 接受了你的对战邀请' : ' 拒绝了你的对战邀请'}
                </Text>
              )}
            </DialogBody>
            <DialogFooter>
              {inviteResponse?.accepted ? (
                <Box as="button" px={5} py={2} borderRadius="3px"
                  bg="linear-gradient(180deg, rgba(200,169,110,0.25) 0%, rgba(200,169,110,0.1) 100%)"
                  color="#e2c88a" border="1px solid rgba(200,169,110,0.35)"
                  fontFamily="Georgia, serif" fontWeight="700" fontSize="14px" letterSpacing="0.04em"
                  cursor={(!deck || deck.filter(c => c.type === 'unit').length < 22) ? 'default' : 'pointer'}
                  opacity={(!deck || deck.filter(c => c.type === 'unit').length < 22) ? 0.4 : 1}
                  _hover={(!deck || deck.filter(c => c.type === 'unit').length < 22) ? {} : { bg: 'linear-gradient(180deg, rgba(200,169,110,0.35) 0%, rgba(200,169,110,0.15) 100%)' }}
                  transition="all 0.2s"
                  disabled={!deck || deck.filter(c => c.type === 'unit').length < 22}
                  onClick={() => inviteResponse && onStartMatch(inviteResponse.from)}>
                  开始对战！
                </Box>
              ) : (
                <Box as="button" px={4} py={2} borderRadius="3px"
                  bg="rgba(186,170,138,0.1)" color="#baaa8a" border="1px solid rgba(186,170,138,0.2)"
                  fontFamily="Georgia, serif" fontWeight="600" cursor="pointer"
                  _hover={{ bg: 'rgba(186,170,138,0.2)' }} transition="all 0.2s"
                  onClick={onCancelInvite}>
                  知道了
                </Box>
              )}
            </DialogFooter>
          </DialogContent>
        </DialogPositioner>
      </DialogRoot>
    </Box>
  );
}
