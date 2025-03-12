module dex::trade;

use std::string::String;
use sui::clock::{timestamp_ms, Clock};
use sui::display;
use sui::ecdsa_k1::secp256k1_verify;
use sui::event;
use sui::hash::blake2b256;
use sui::package;
use sui::vec_map::{VecMap, empty};

const DEX_VERSION: u32 = 1;

public struct MinaSignature has copy, drop, store {
    r: u256,
    s: u256,
}

fun signature_to_bytes(signature: &MinaSignature): vector<u8> {
    let mut bytes = vector::empty<u8>();
    let r_bytes = std::bcs::to_bytes(&signature.r);
    let s_bytes = std::bcs::to_bytes(&signature.s);
    vector::append(&mut bytes, r_bytes);
    vector::append(&mut bytes, s_bytes);
    bytes
}

use fun signature_to_bytes as MinaSignature.to_bytes;

public struct MinaBalance has copy, drop, store {
    amount: u64,
    stakedAmount: u64,
    borrowedAmount: u64,
}

public struct Order has copy, drop, store {
    amount: u64,
    price: u64,
    isSome: bool,
}

public struct User has key, store {
    id: UID,
    publicKey: u256,
    publicKeyBase58: String,
    name: String,
    role: String,
    image: String,
}

public struct UserTradingAccount has copy, drop, store {
    baseTokenBalance: MinaBalance,
    quoteTokenBalance: MinaBalance,
    bid: Order,
    ask: Order,
    nonce: u64,
}

public struct Token has key, store {
    id: UID,
    address: address,
    publicKey: u256,
    publicKeyBase58: String,
    tokenId: u256,
    token: String,
    name: String,
    description: String,
    image: String,
}

public struct TokenCreateEvent has copy, drop {
    address: address,
    publicKey: u256,
    publicKeyBase58: String,
    tokenId: u256,
    token: String,
    name: String,
    description: String,
    image: String,
}

const OPERATION_CREATE_ACCOUNT: u8 = 1;
const OPERATION_BID: u8 = 2;
const OPERATION_ASK: u8 = 3;
const OPERATION_TRADE: u8 = 4;
const OPERATION_TRANSFER: u8 = 5;
// const OPERATION_WITHDRAW: u8 = 6;
// const OPERATION_DEPOSIT: u8 = 7;
// const OPERATION_STAKE: u8 = 8;
// const OPERATION_UNSTAKE: u8 = 9;

public struct OperationDataInput has copy, drop {
    pool: String,
    poolPublicKey: u256,
    operation: u8,
    accountPublicKey: u256,
    nonce: u64,
    baseTokenAmount: Option<u64>,
    quoteTokenAmount: Option<u64>,
    price: Option<u64>,
    receiverPublicKey: Option<u256>,
    receiverNonce: Option<u64>,
}
public struct OperationData has copy, drop {
    operation: u8,
    pool: String,
    poolPublicKey: u256,
    data: vector<u8>,
}

public struct Operation has copy, drop {
    operation: u8,
    sequence: u64,
    block_number: u64,
    pool: String,
    poolPublicKey: u256,
    actionState: vector<u8>,
    data: vector<u8>,
}

public struct ActionCreateAccount has copy, drop {
    address: address,
    publicKey: u256,
    publicKeyBase58: String,
    name: String,
    role: String,
    image: String,
    baseBalance: u64,
    quoteBalance: u64,
}

public struct ActionBid has copy, drop {
    userPublicKey: u256,
    poolPublicKey: u256,
    baseTokenAmount: u64,
    price: u64,
    isSome: bool,
    nonce: u64,
    userSignature: MinaSignature,
}

public struct ActionAsk has copy, drop {
    userPublicKey: u256,
    poolPublicKey: u256,
    baseTokenAmount: u64,
    price: u64,
    isSome: bool,
    nonce: u64,
    userSignature: MinaSignature,
}

public struct ActionTrade has copy, drop {
    buyerPublicKey: u256,
    sellerPublicKey: u256,
    poolPublicKey: u256,
    baseTokenAmount: u64,
    quoteTokenAmount: u64,
    price: u64,
    buyerNonce: u64,
    sellerNonce: u64,
}

public struct ActionTransfer has copy, drop {
    senderPublicKey: u256,
    senderSignature: MinaSignature,
    senderNonce: u64,
    receiverPublicKey: u256,
    baseTokenAmount: u64,
    quoteTokenAmount: u64,
}

public struct OperationCreateAccountEvent has copy, drop {
    operation: Operation,
    details: ActionCreateAccount,
}

public struct OperationBidEvent has copy, drop {
    operation: Operation,
    details: ActionBid,
}

public struct OperationAskEvent has copy, drop {
    operation: Operation,
    details: ActionAsk,
}

public struct OperationTradeEvent has copy, drop {
    operation: Operation,
    details: ActionTrade,
}

public struct OperationTransferEvent has copy, drop {
    operation: Operation,
    details: ActionTransfer,
}

public struct Pool has key, store {
    id: UID,
    name: String,
    publicKey: u256,
    publicKeyBase58: String,
    baseTokenId: u256,
    quoteTokenId: u256,
    lastPrice: u64,
    accounts: VecMap<u256, UserTradingAccount>,
}

public struct PoolCreateEvent has copy, drop {
    address: address,
    name: String,
    publicKey: u256,
    publicKeyBase58: String,
    baseTokenId: u256,
    quoteTokenId: u256,
}

public struct BlockState has key, store {
    id: UID,
    name: String,
    block_number: u64,
    state: VecMap<u256, UserTradingAccount>,
}

public struct Block has key, store {
    id: UID,
    name: String,
    block_number: u64,
    block_state: address,
    timestamp: u64,
    time_since_last_block: u64,
    number_of_transactions: u64,
    sequences: vector<u64>,
    start_action_state: vector<u8>,
    end_action_state: vector<u8>,
    state_data_availability: Option<String>,
    proof_data_availability: Option<String>,
    mina_tx_hash: Option<String>,
    mina_tx_included_in_block: Option<u64>,
    previous_block_address: Option<address>,
}

public struct BlockEvent has copy, drop {
    address: address,
    name: String,
    block_number: u64,
    timestamp: u64,
    block_state: address,
    previous_block_address: Option<address>,
    time_since_last_block: u64,
    number_of_transactions: u64,
    sequences: vector<u64>,
    start_action_state: vector<u8>,
    end_action_state: vector<u8>,
    state_data_availability: Option<String>,
    proof_data_availability: Option<String>,
}

public struct DEX has key, store {
    id: UID,
    name: String,
    admin: address,
    public_key: vector<u8>,
    version: u32,
    actionsState: vector<u8>,
    sequence: u64,
    previous_block_timestamp: u64,
    previous_block_sequence: u64,
    previous_block_actions_state: vector<u8>,
    block_number: u64,
    poolId: Option<ID>,
    poolAddress: Option<address>,
    last_block_address: Option<address>,
    tokens: VecMap<u256, Token>,
    isPaused: bool,
}

public struct DEXCreateEvent has copy, drop {
    address: address,
    admin: address,
    version: u32,
    actionsState: vector<u8>,
}

// Error codes
#[error]
const EInvalidAsk: vector<u8> = b"Invalid ask";
#[error]
const EInvalidBid: vector<u8> = b"Invalid bid";
#[error]
const EInsufficientAsk: vector<u8> = b"Insufficient ask";
#[error]
const EInsufficientBid: vector<u8> = b"Insufficient bid";
#[error]
const EInvalidAskPrice: vector<u8> = b"Invalid ask price";
#[error]
const EInvalidBidPrice: vector<u8> = b"Invalid bid price";
#[error]
const ECannotTransferBorrowedAmount: vector<u8> = b"Cannot transfer borrowed amount";
#[error]
const EInsufficientSenderBalance: vector<u8> = b"Insufficient sender balance";
#[error]
const EInvalidSignature: vector<u8> = b"Invalid signature";
#[error]
const ENotAuthorized: vector<u8> = b"Not authorized";
#[error]
const EInvalidPublicKey: vector<u8> = b"Invalid public key";
#[error]
const EDEXPaused: vector<u8> = b"DEX is paused";
#[error]
const EInsufficientBalance: vector<u8> = b"Insufficient balance";
#[error]
const EInvalidAmount: vector<u8> = b"Invalid amount";
#[error]
const EInvalidPrice: vector<u8> = b"Invalid price";

public struct TRADE has drop {}

fun init(otw: TRADE, ctx: &mut TxContext) {
    let bytes = vector<u8>[0];
    let hash = blake2b256(&bytes);
    let dex = DEX {
        id: object::new(ctx),
        name: b"Silvana DEX".to_string(),
        admin: ctx.sender(),
        public_key: vector::empty<u8>(),
        version: DEX_VERSION,
        actionsState: hash,
        sequence: 0,
        previous_block_sequence: 0,
        previous_block_timestamp: 0,
        previous_block_actions_state: hash,
        block_number: 0,
        poolId: option::none(),
        poolAddress: option::none(),
        isPaused: true,
        tokens: empty<u256, Token>(),
        last_block_address: option::none(),
    };

    event::emit(DEXCreateEvent {
        address: dex.id.to_address(),
        admin: dex.admin,
        version: dex.version,
        actionsState: dex.actionsState,
    });

    let publisher = package::claim(otw, ctx);

    let dex_keys = vector[
        b"name".to_string(),
        b"description".to_string(),
        b"project_url".to_string(),
        b"creator".to_string(),
    ];

    let dex_values = vector[
        b"Silvana DEX".to_string(),
        b"Silvana DEX is a decentralized exchange for the Mina protocol".to_string(),
        b"https://dex.silvana.dev".to_string(),
        b"DFST".to_string(),
    ];
    let mut display_dex = display::new_with_fields<DEX>(
        &publisher,
        dex_keys,
        dex_values,
        ctx,
    );

    let pool_keys = vector[
        b"name".to_string(),
        b"link".to_string(),
        b"project_url".to_string(),
        b"creator".to_string(),
    ];

    let pool_values = vector[
        b"{name}".to_string(),
        b"https://minascan.io/devnet/account/{publicKeyBase58}".to_string(),
        b"https://dex.silvana.dev".to_string(),
        b"DFST".to_string(),
    ];

    let mut display_pool = display::new_with_fields<Pool>(
        &publisher,
        pool_keys,
        pool_values,
        ctx,
    );

    let token_keys = vector[
        b"name".to_string(),
        b"link".to_string(),
        b"project_url".to_string(),
        b"creator".to_string(),
    ];

    let token_values = vector[
        b"{name}".to_string(),
        b"https://minascan.io/devnet/account/{publicKeyBase58}".to_string(),
        b"https://dex.silvana.dev".to_string(),
        b"DFST".to_string(),
    ];
    let mut display_token = display::new_with_fields<Token>(
        &publisher,
        token_keys,
        token_values,
        ctx,
    );

    let user_keys = vector[
        b"name".to_string(),
        b"link".to_string(),
        b"image_url".to_string(),
        b"thumbnail_url".to_string(),
        b"description".to_string(),
        b"project_url".to_string(),
        b"creator".to_string(),
    ];

    let user_values = vector[
        b"{name}".to_string(),
        b"https://minascan.io/devnet/account/{publicKeyBase58}".to_string(),
        b"{image}".to_string(),
        b"{image}".to_string(),
        b"{role}".to_string(),
        b"https://dex.silvana.dev".to_string(),
        b"DFST".to_string(),
    ];
    let mut display_user = display::new_with_fields<User>(
        &publisher,
        user_keys,
        user_values,
        ctx,
    );

    let block_keys = vector[
        b"name".to_string(),
        b"link".to_string(),
        b"image_url".to_string(),
        b"thumbnail_url".to_string(),
        b"description".to_string(),
        b"project_url".to_string(),
        b"creator".to_string(),
    ];

    let block_values = vector[
        b"{name}".to_string(),
        b"https://walruscan.com/testnet/blob/{state_data_availability}".to_string(),
        b"{image}".to_string(),
        b"{image}".to_string(),
        b"{role}".to_string(),
        b"https://dex.silvana.dev".to_string(),
        b"DFST".to_string(),
    ];
    let mut display_block = display::new_with_fields<Block>(
        &publisher,
        block_keys,
        block_values,
        ctx,
    );

    display_dex.update_version();
    display_pool.update_version();
    display_token.update_version();
    display_user.update_version();
    display_block.update_version();
    transfer::public_transfer(publisher, ctx.sender());
    transfer::public_transfer(display_dex, ctx.sender());
    transfer::public_transfer(display_pool, ctx.sender());
    transfer::public_transfer(display_token, ctx.sender());
    transfer::public_transfer(display_user, ctx.sender());
    transfer::public_transfer(display_block, ctx.sender());
    transfer::share_object(dex);
}

fun only_admin(dex: &DEX, ctx: &TxContext) {
    assert!(dex.admin == ctx.sender(), ENotAuthorized);
}

fun not_paused(dex: &DEX) {
    assert!(dex.isPaused == false, EDEXPaused);
}

public fun create_token(
    dex: &mut DEX,
    publicKey: u256,
    publicKeyBase58: String,
    tokenId: u256,
    token: String,
    name: String,
    description: String,
    image: String,
    ctx: &mut TxContext,
) {
    only_admin(dex, ctx);
    let id = object::new(ctx);
    let address = id.to_address();
    let token = Token {
        id,
        address,
        publicKey,
        publicKeyBase58,
        tokenId,
        token,
        name,
        description,
        image,
    };
    event::emit(TokenCreateEvent {
        address,
        publicKey: token.publicKey,
        publicKeyBase58: token.publicKeyBase58,
        tokenId: token.tokenId,
        token: token.token,
        name: token.name,
        description: token.description,
        image: token.image,
    });
    dex.tokens.insert(token.tokenId, token);
}

public fun create_pool(
    dex: &mut DEX,
    clock: &Clock,
    name: String,
    publicKey: u256,
    publicKeyBase58: String,
    baseTokenId: u256,
    quoteTokenId: u256,
    initialPrice: u64,
    ctx: &mut TxContext,
): address {
    only_admin(dex, ctx);
    let pool = Pool {
        id: object::new(ctx),
        name,
        publicKey,
        publicKeyBase58,
        baseTokenId,
        quoteTokenId,
        accounts: empty<u256, UserTradingAccount>(),
        lastPrice: initialPrice,
    };
    let poolAddress = pool.id.to_address();
    let poolId = pool.id.to_inner();
    dex.poolId = option::some(poolId);
    dex.poolAddress = option::some(poolAddress);
    let timestamp = clock.timestamp_ms();
    dex.previous_block_timestamp = timestamp;

    event::emit(PoolCreateEvent {
        address: poolAddress,
        name: pool.name,
        publicKey: pool.publicKey,
        publicKeyBase58: pool.publicKeyBase58,
        baseTokenId: pool.baseTokenId,
        quoteTokenId: pool.quoteTokenId,
    });

    create_block(dex, &pool, clock, ctx);
    transfer::share_object(pool);
    poolAddress
}

public fun create_account(
    dex: &mut DEX,
    pool: &mut Pool,
    publicKey: u256,
    publicKeyBase58: String,
    role: String,
    image: String,
    name: String,
    baseBalance: u64,
    quoteBalance: u64,
    ctx: &mut TxContext,
): address {
    not_paused(dex);
    only_admin(dex, ctx);
    let user = User {
        id: object::new(ctx),
        publicKey,
        publicKeyBase58,
        name,
        role,
        image,
    };

    let account = UserTradingAccount {
        baseTokenBalance: MinaBalance {
            amount: baseBalance,
            stakedAmount: 0,
            borrowedAmount: 0,
        },
        quoteTokenBalance: MinaBalance {
            amount: quoteBalance,
            stakedAmount: 0,
            borrowedAmount: 0,
        },
        bid: Order {
            amount: 0,
            price: 0,
            isSome: false,
        },
        ask: Order {
            amount: 0,
            price: 0,
            isSome: false,
        },
        nonce: 0,
    };

    pool.accounts.insert(publicKey, account);
    let operation = OPERATION_CREATE_ACCOUNT;

    let operationData = create_operation_data(OperationDataInput {
        pool: pool.name,
        poolPublicKey: pool.publicKey,
        operation: operation,
        accountPublicKey: publicKey,
        nonce: account.nonce,
        baseTokenAmount: option::some(baseBalance),
        quoteTokenAmount: option::some(quoteBalance),
        price: option::none(),
        receiverPublicKey: option::none(),
        receiverNonce: option::none(),
    });
    let operation = update_actions_state(
        dex,
        &operationData,
    );
    let address = user.id.to_address();
    event::emit(OperationCreateAccountEvent {
        operation,
        details: ActionCreateAccount {
            address,
            publicKey: user.publicKey,
            publicKeyBase58: user.publicKeyBase58,
            name,
            role,
            image,
            baseBalance,
            quoteBalance,
        },
    });
    transfer::freeze_object(user);
    address
}

public fun bid(
    dex: &mut DEX,
    pool: &mut Pool,
    publicKey: u256,
    baseTokenAmount: u64,
    price: u64,
    userSignature_r: u256,
    userSignature_s: u256,
    validatorSignature: vector<u8>,
) {
    not_paused(dex);
    assert!(price > 0 || baseTokenAmount == 0, EInvalidPrice);
    let quoteAmount = ((baseTokenAmount as u128) * (price as u128) / 1_000_000_000u128) as u64;
    let userSignature = MinaSignature {
        r: userSignature_r,
        s: userSignature_s,
    };
    let account = pool.accounts.get_mut(&publicKey);
    let operation = OPERATION_BID;

    assert!(account.quoteTokenBalance.amount >= quoteAmount, EInsufficientBalance);

    let operationData = create_operation_data(OperationDataInput {
        pool: pool.name,
        poolPublicKey: pool.publicKey,
        operation,
        accountPublicKey: publicKey,
        nonce: account.nonce,
        baseTokenAmount: option::some(baseTokenAmount),
        quoteTokenAmount: option::none(),
        price: option::some(price),
        receiverPublicKey: option::none(),
        receiverNonce: option::none(),
    });

    let valid = verify_signature(
        dex,
        validatorSignature,
        userSignature,
        &operationData,
    );
    assert!(valid, EInvalidSignature);
    account.bid.amount = baseTokenAmount;
    account.bid.price = price;
    account.bid.isSome = baseTokenAmount != 0 && price != 0;

    let operation = update_actions_state(
        dex,
        &operationData,
    );

    event::emit(OperationBidEvent {
        operation,
        details: ActionBid {
            userPublicKey: publicKey,
            poolPublicKey: pool.publicKey,
            baseTokenAmount,
            price,
            userSignature,
            isSome: account.bid.isSome,
            nonce: account.nonce,
        },
    });
    account.nonce = account.nonce + 1;
}

public fun ask(
    dex: &mut DEX,
    pool: &mut Pool,
    publicKey: u256,
    baseTokenAmount: u64,
    price: u64,
    userSignature_r: u256,
    userSignature_s: u256,
    validatorSignature: vector<u8>,
) {
    not_paused(dex);
    assert!(price > 0 || baseTokenAmount == 0, EInvalidPrice);
    let userSignature = MinaSignature {
        r: userSignature_r,
        s: userSignature_s,
    };
    let account = pool.accounts.get_mut(&publicKey);
    assert!(account.baseTokenBalance.amount >= baseTokenAmount, EInsufficientBalance);
    let operation = OPERATION_ASK;
    let operationData = create_operation_data(OperationDataInput {
        pool: pool.name,
        poolPublicKey: pool.publicKey,
        operation,
        accountPublicKey: publicKey,
        nonce: account.nonce,
        baseTokenAmount: option::some(baseTokenAmount),
        quoteTokenAmount: option::none(),
        price: option::some(price),
        receiverPublicKey: option::none(),
        receiverNonce: option::none(),
    });
    let valid = verify_signature(
        dex,
        validatorSignature,
        userSignature,
        &operationData,
    );
    assert!(valid, EInvalidSignature);
    account.ask.amount = baseTokenAmount;
    account.ask.price = price;
    account.ask.isSome = baseTokenAmount != 0 && price != 0;

    let operation = update_actions_state(
        dex,
        &operationData,
    );

    event::emit(OperationAskEvent {
        operation,
        details: ActionAsk {
            userPublicKey: publicKey,
            poolPublicKey: pool.publicKey,
            baseTokenAmount,
            price,
            isSome: account.ask.isSome,
            nonce: account.nonce,
            userSignature,
        },
    });
    account.nonce = account.nonce + 1;
}

public fun trade(
    dex: &mut DEX,
    pool: &mut Pool,
    buyerPublicKey: u256,
    sellerPublicKey: u256,
    baseTokenAmount: u64,
    quoteTokenAmount: u64,
) {
    not_paused(dex);
    assert!(baseTokenAmount > 0, EInvalidAmount);
    assert!(quoteTokenAmount > 0, EInvalidAmount);

    let buyerNonce;
    {
        let buyerAccount = pool.accounts.get_mut(&buyerPublicKey);
        assert!(buyerAccount.bid.isSome, EInvalidBid);
        assert!(buyerAccount.bid.amount >= baseTokenAmount, EInsufficientBid);
        assert!(
            (buyerAccount.bid.price as u128) * (baseTokenAmount as u128)  >= (quoteTokenAmount as u128) * 1_000_000_000u128,
            EInvalidBidPrice,
        );
        assert!(buyerAccount.quoteTokenBalance.amount >= quoteTokenAmount, EInsufficientBalance);
        buyerAccount.bid.amount = buyerAccount.bid.amount - baseTokenAmount;
        buyerAccount.baseTokenBalance.amount =
            buyerAccount.baseTokenBalance.amount + baseTokenAmount;
        buyerAccount.quoteTokenBalance.amount =
            buyerAccount.quoteTokenBalance.amount - quoteTokenAmount;
        buyerNonce = buyerAccount.nonce;

        if (buyerAccount.bid.amount == 0) {
            buyerAccount.bid.isSome = false;
        }
    };

    let sellerNonce;
    {
        let sellerAccount = pool.accounts.get_mut(&sellerPublicKey);
        assert!(sellerAccount.ask.isSome, EInvalidAsk);
        assert!(sellerAccount.ask.amount >= baseTokenAmount, EInsufficientAsk);
        assert!(
            (sellerAccount.ask.price as u128) * (baseTokenAmount as u128)  <= (quoteTokenAmount as u128) * 1_000_000_000u128,
            EInvalidAskPrice,
        );
        assert!(sellerAccount.baseTokenBalance.amount >= baseTokenAmount, EInsufficientBalance);
        sellerAccount.ask.amount = sellerAccount.ask.amount - baseTokenAmount;
        sellerAccount.baseTokenBalance.amount =
            sellerAccount.baseTokenBalance.amount - baseTokenAmount;
        sellerAccount.quoteTokenBalance.amount =
            sellerAccount.quoteTokenBalance.amount + quoteTokenAmount;
        sellerNonce = sellerAccount.nonce;

        if (sellerAccount.ask.amount == 0) {
            sellerAccount.ask.isSome = false;
        }
    };

    let operation = OPERATION_TRADE;

    let operationData = create_operation_data(OperationDataInput {
        pool: pool.name,
        poolPublicKey: pool.publicKey,
        operation,
        accountPublicKey: sellerPublicKey,
        nonce: sellerNonce,
        baseTokenAmount: option::some(baseTokenAmount),
        quoteTokenAmount: option::some(quoteTokenAmount),
        price: option::none(),
        receiverPublicKey: option::some(buyerPublicKey),
        receiverNonce: option::some(buyerNonce),
    });
    let operation = update_actions_state(
        dex,
        &operationData,
    );
    let price = ((quoteTokenAmount as u128) * 1_000_000_000u128 / (baseTokenAmount as u128) as u64);
    event::emit(OperationTradeEvent {
        operation,
        details: ActionTrade {
            buyerPublicKey,
            sellerPublicKey,
            poolPublicKey: pool.publicKey,
            baseTokenAmount,
            quoteTokenAmount,
            price,
            buyerNonce,
            sellerNonce,
        },
    });
}

public fun transfer(
    dex: &mut DEX,
    pool: &mut Pool,
    senderPublicKey: u256,
    receiverPublicKey: u256,
    baseTokenAmount: u64,
    quoteTokenAmount: u64,
    senderSignature_r: u256,
    senderSignature_s: u256,
    validatorSignature: vector<u8>,
) {
    not_paused(dex);
    assert!(baseTokenAmount > 0 || quoteTokenAmount > 0, EInvalidAmount);
    let operation = OPERATION_TRANSFER;
    let senderSignature = MinaSignature {
        r: senderSignature_r,
        s: senderSignature_s,
    };
    let senderNonce;
    {
        let senderAccount = pool.accounts.get_mut(&senderPublicKey);
        assert!(
            senderAccount.baseTokenBalance.amount >= baseTokenAmount,
            EInsufficientSenderBalance,
        );
        assert!(
            senderAccount.quoteTokenBalance.amount >= quoteTokenAmount,
            EInsufficientSenderBalance,
        );
        assert!(senderAccount.baseTokenBalance.borrowedAmount == 0, ECannotTransferBorrowedAmount);
        assert!(senderAccount.quoteTokenBalance.borrowedAmount == 0, ECannotTransferBorrowedAmount);

        senderAccount.baseTokenBalance.amount =
            senderAccount.baseTokenBalance.amount - baseTokenAmount;
        senderAccount.quoteTokenBalance.amount =
            senderAccount.quoteTokenBalance.amount - quoteTokenAmount;
        senderNonce = senderAccount.nonce;
        senderAccount.nonce = senderAccount.nonce + 1;
    };

    {
        let receiverAccount = pool.accounts.get_mut(&receiverPublicKey);
        receiverAccount.baseTokenBalance.amount =
            receiverAccount.baseTokenBalance.amount + baseTokenAmount;
        receiverAccount.quoteTokenBalance.amount =
            receiverAccount.quoteTokenBalance.amount + quoteTokenAmount;
    };

    let operationData = create_operation_data(OperationDataInput {
        pool: pool.name,
        poolPublicKey: pool.publicKey,
        operation,
        accountPublicKey: senderPublicKey,
        nonce: senderNonce,
        baseTokenAmount: option::some(baseTokenAmount),
        quoteTokenAmount: option::some(quoteTokenAmount),
        price: option::none(),
        receiverPublicKey: option::some(receiverPublicKey),
        receiverNonce: option::none(),
    });

    let valid = verify_signature(
        dex,
        validatorSignature,
        senderSignature,
        &operationData,
    );
    assert!(valid, EInvalidSignature);
    let operation = update_actions_state(
        dex,
        &operationData,
    );
    event::emit(OperationTransferEvent {
        operation,
        details: ActionTransfer {
            senderPublicKey,
            receiverPublicKey,
            baseTokenAmount,
            quoteTokenAmount,
            senderNonce,
            senderSignature,
        },
    });
}

#[allow(lint(self_transfer))]
public fun create_block(dex: &mut DEX, pool: &Pool, clock: &Clock, ctx: &mut TxContext) {
    only_admin(dex, ctx);
    let timestamp = clock.timestamp_ms();
    let mut sequences = vector::empty<u64>();
    let mut i = dex.previous_block_sequence + 1;
    while (i <= dex.sequence) {
        vector::push_back(&mut sequences, i);
        i = i + 1;
    };
    let mut name: String = b"Silvana DEX Block ".to_string();
    name.append(dex.block_number.to_string());
    let mut block_state_name: String = b"Silvana DEX Block ".to_string();
    block_state_name.append(dex.block_number.to_string());
    block_state_name.append(b" State".to_string());
    let block_state = BlockState {
        id: object::new(ctx),
        name: block_state_name,
        block_number: dex.block_number,
        state: pool.accounts,
    };
    let block = Block {
        id: object::new(ctx),
        name,
        block_number: dex.block_number,
        block_state: block_state.id.to_address(),
        timestamp,
        time_since_last_block: timestamp - dex.previous_block_timestamp,
        number_of_transactions: vector::length(&sequences),
        sequences,
        start_action_state: dex.previous_block_actions_state,
        end_action_state: dex.actionsState,
        state_data_availability: option::none(),
        proof_data_availability: option::none(),
        mina_tx_hash: option::none(),
        mina_tx_included_in_block: option::none(),
        previous_block_address: dex.last_block_address,
    };

    dex.previous_block_sequence = dex.sequence;
    dex.previous_block_actions_state = dex.actionsState;
    dex.previous_block_timestamp = timestamp;

    dex.last_block_address = option::some(block.id.to_address());
    event::emit(BlockEvent {
        address: block.id.to_address(),
        block_number: dex.block_number,
        name,
        timestamp,
        block_state: block_state.id.to_address(),
        previous_block_address: block.previous_block_address,
        time_since_last_block: timestamp - dex.previous_block_timestamp,
        number_of_transactions: vector::length(&sequences),
        sequences,
        start_action_state: dex.previous_block_actions_state,
        end_action_state: dex.actionsState,
        state_data_availability: block.state_data_availability,
        proof_data_availability: option::none(),
    });
    transfer::transfer(block_state, ctx.sender());
    transfer::transfer(block, ctx.sender());
    dex.block_number = dex.block_number + 1;
}

public fun update_block_state_data_availability(
    block: &mut Block,
    state_data_availability: String,
) {
    block.state_data_availability = option::some(state_data_availability);
    event::emit(BlockEvent {
        address: block.id.to_address(),
        block_number: block.block_number,
        name: block.name,
        timestamp: block.timestamp,
        block_state: block.block_state,
        previous_block_address: block.previous_block_address,
        time_since_last_block: block.time_since_last_block,
        number_of_transactions: vector::length(&block.sequences),
        sequences: block.sequences,
        start_action_state: block.start_action_state,
        end_action_state: block.end_action_state,
        state_data_availability: block.state_data_availability,
        proof_data_availability: block.proof_data_availability,
    });
}

public fun update_block_proof_data_availability(
    block: &mut Block,
    proof_data_availability: String,
) {
    block.proof_data_availability = option::some(proof_data_availability);
    event::emit(BlockEvent {
        address: block.id.to_address(),
        block_number: block.block_number,
        name: block.name,
        timestamp: block.timestamp,
        block_state: block.block_state,
        previous_block_address: block.previous_block_address,
        time_since_last_block: block.time_since_last_block,
        number_of_transactions: vector::length(&block.sequences),
        sequences: block.sequences,
        start_action_state: block.start_action_state,
        end_action_state: block.end_action_state,
        state_data_availability: block.state_data_availability,
        proof_data_availability: block.proof_data_availability,
    });
}

public fun update_block_mina_tx_hash(block: &mut Block, mina_tx_hash: String) {
    block.mina_tx_hash = option::some(mina_tx_hash);
    event::emit(BlockEvent {
        address: block.id.to_address(),
        block_number: block.block_number,
        name: block.name,
        timestamp: block.timestamp,
        block_state: block.block_state,
        previous_block_address: block.previous_block_address,
        time_since_last_block: block.time_since_last_block,
        number_of_transactions: vector::length(&block.sequences),
        sequences: block.sequences,
        start_action_state: block.start_action_state,
        end_action_state: block.end_action_state,
        state_data_availability: block.state_data_availability,
        proof_data_availability: block.proof_data_availability,
    });
}

public fun update_block_mina_tx_included_in_block(
    block: &mut Block,
    mina_tx_included_in_block: u64,
) {
    block.mina_tx_included_in_block = option::some(mina_tx_included_in_block);
    event::emit(BlockEvent {
        address: block.id.to_address(),
        block_number: block.block_number,
        name: block.name,
        timestamp: block.timestamp,
        block_state: block.block_state,
        previous_block_address: block.previous_block_address,
        time_since_last_block: block.time_since_last_block,
        number_of_transactions: vector::length(&block.sequences),
        sequences: block.sequences,
        start_action_state: block.start_action_state,
        end_action_state: block.end_action_state,
        state_data_availability: block.state_data_availability,
        proof_data_availability: block.proof_data_availability,
    });
}

public fun set_public_key(dex: &mut DEX, public_key: vector<u8>, ctx: &mut TxContext) {
    only_admin(dex, ctx);
    assert!(vector::length(&public_key) == 33, EInvalidPublicKey);
    dex.public_key = public_key;
    dex.isPaused = false;
}

const DEX_SIGNATURE_CONTEXT: u256 = 7738487874684489969637964886483;

#[allow(implicit_const_copy)]
public fun verify_signature(
    dex: &DEX,
    signature: vector<u8>,
    minaSignature: MinaSignature,
    operationData: &OperationData,
): bool {
    let public_key = dex.public_key;
    assert!(vector::length(&public_key) == 33, EInvalidPublicKey);
    let mut msg = vector::empty<u8>();
    vector::append(&mut msg, std::bcs::to_bytes(&DEX_SIGNATURE_CONTEXT));
    vector::append(&mut msg, minaSignature.to_bytes());
    vector::append(&mut msg, operationData.data);
    let hash: u8 = 1;
    let valid = secp256k1_verify(&signature, &public_key, &msg, hash);
    assert!(valid, EInvalidSignature);
    valid
}

#[allow(implicit_const_copy)]
fun create_operation_data(data: OperationDataInput): OperationData {
    let mut msg = vector::empty<u8>();
    vector::append(&mut msg, std::bcs::to_bytes(&data.poolPublicKey));
    vector::append(&mut msg, std::bcs::to_bytes(&data.operation));
    vector::append(&mut msg, std::bcs::to_bytes(&data.accountPublicKey));
    vector::append(&mut msg, std::bcs::to_bytes(&data.nonce));

    if (data.baseTokenAmount.is_some()) {
        vector::append(&mut msg, std::bcs::to_bytes(data.baseTokenAmount.borrow()));
    };
    if (data.quoteTokenAmount.is_some()) {
        vector::append(&mut msg, std::bcs::to_bytes(data.quoteTokenAmount.borrow()));
    };
    if (data.price.is_some()) {
        vector::append(&mut msg, std::bcs::to_bytes(data.price.borrow()));
    };
    if (data.receiverPublicKey.is_some()) {
        vector::append(&mut msg, std::bcs::to_bytes(data.receiverPublicKey.borrow()));
    };
    if (data.receiverNonce.is_some()) {
        vector::append(&mut msg, std::bcs::to_bytes(data.receiverNonce.borrow()));
    };
    OperationData {
        operation: data.operation,
        pool: data.pool,
        poolPublicKey: data.poolPublicKey,
        data: msg,
    }
}

fun update_actions_state(dex: &mut DEX, operationData: &OperationData): Operation {
    assert!(dex.isPaused == false, EDEXPaused);
    let mut data = vector::empty<u8>();
    vector::append(&mut data, dex.actionsState);
    vector::append(&mut data, operationData.data);
    let hash = blake2b256(&data);
    dex.actionsState = hash;
    dex.sequence = dex.sequence + 1;
    Operation {
        operation: operationData.operation,
        sequence: dex.sequence,
        block_number: dex.block_number,
        actionState: hash,
        data,
        pool: operationData.pool,
        poolPublicKey: operationData.poolPublicKey,
    }
}
