// A player's nickname linking to their public profile. Deleted accounts (no id)
// render as plain text.
export default function PlayerLink({ userId, nickname }: { userId?: number | null; nickname: string }) {
  if (!userId) {
    return <>{nickname}</>;
  }
  return (
    <a className="player-link" href={`#/hrac/${userId}`}>
      {nickname}
    </a>
  );
}
