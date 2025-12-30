use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid value")]
    InvalidValue,
    #[msg("Invalid percentages, must sum to 10000 bps")]
    InvalidPercentages,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Bid is over, call endgame instruction to initialize next pot")]
    BidIsOver,
    #[msg("Game still in progress")]
    GameInProgress,
    #[msg("Winner account mismatch")]
    WrongWinner,
    #[msg("Fee account mismatch")]
    WrongFeeAccount,
}

