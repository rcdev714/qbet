-- Trigger to update option pool when a bet is placed
DROP TRIGGER IF EXISTS on_bet_placed ON public.bets;

CREATE TRIGGER on_bet_placed
  AFTER INSERT ON public.bets
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_option_pool_on_bet_insert();
