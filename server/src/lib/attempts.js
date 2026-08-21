export const MAX_TRIES = 3;
export const today = () => new Date().toISOString().slice(0,10);

export function attemptsLeft(player){
  if(player.attemptsDate !== today()) return MAX_TRIES;
  return Math.max(0, MAX_TRIES - player.attemptsUsed);
}
export function useAttempt(player){
  if(player.attemptsDate !== today()){ player.attemptsDate = today(); player.attemptsUsed = 0; }
  player.attemptsUsed += 1;
}
