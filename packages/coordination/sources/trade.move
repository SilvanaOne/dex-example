module dex::trade;

use std::string::String;
use sui::ecdsa_k1::secp256k1_verify;
use sui::event;
use sui::hash::blake2b256;
use sui::vec_map::{VecMap, empty};

const DEX_VERSION: u32 = 1;

public struct MinaPublicKey has copy, drop, store {
    x: u256,
    isOdd: bool,
}

fun public_key_to_bytes(publicKey: &MinaPublicKey): vector<u8> {
    let mut bytes = vector::empty<u8>();
    let x_bytes = std::bcs::to_bytes(&publicKey.x);
    let is_odd_bytes = std::bcs::to_bytes(&publicKey.isOdd);
    vector::append(&mut bytes, x_bytes);
    vector::append(&mut bytes, is_odd_bytes);
    bytes
}

use fun public_key_to_bytes as MinaPublicKey.to_bytes;

fun bool_to_u256(x: bool): u256 {
    if (x) {
        1u256
    } else {
        0u256
    }
}

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
    borrowedAmount: u64,
}

public struct Order has store {
    amount: u64,
    price: u64,
    isSome: bool,
}

public struct UserTradingAccount has store {
    name: String,
    base58PublicKey: String,
    baseTokenBalance: MinaBalance,
    quoteTokenBalance: MinaBalance,
    bid: Order,
    ask: Order,
    nonce: u64,
}

#[allow(unused_field)]
public struct Token has copy, drop, store {
    publicKey: MinaPublicKey,
    tokenId: u256,
    token: String,
    name: String,
    description: String,
}

const OPERATION_CREATE_ACCOUNT: u8 = 1;
const OPERATION_BID: u8 = 2;
const OPERATION_ASK: u8 = 3;
const OPERATION_TRADE: u8 = 4;
const OPERATION_TRANSFER_BASE_TOKEN: u8 = 5;
const OPERATION_TRANSFER_QUOTE_TOKEN: u8 = 6;

public struct ActionCreateAccount has copy, drop {
    name: String,
    base58PublicKey: String,
    userPublicKey: MinaPublicKey,
    poolPublicKey: MinaPublicKey,
    baseBalance: u64,
    quoteBalance: u64,
}

public struct ActionBid has copy, drop {
    userPublicKey: MinaPublicKey,
    poolPublicKey: MinaPublicKey,
    amount: u64,
    price: u64,
    isSome: bool,
    nonce: u64,
    userSignature: MinaSignature,
}

public struct ActionAsk has copy, drop {
    userPublicKey: MinaPublicKey,
    poolPublicKey: MinaPublicKey,
    amount: u64,
    price: u64,
    isSome: bool,
    nonce: u64,
    userSignature: MinaSignature,
}

public struct ActionTrade has copy, drop {
    buyerPublicKey: MinaPublicKey,
    sellerPublicKey: MinaPublicKey,
    poolPublicKey: MinaPublicKey,
    amount: u64,
    quoteAmount: u64,
    price: u64,
    buyerNonce: u64,
    sellerNonce: u64,
}

public struct ActionTransferBaseToken has copy, drop {
    senderPublicKey: MinaPublicKey,
    receiverPublicKey: MinaPublicKey,
    amount: u64,
    senderNonce: u64,
    receiverNonce: u64,
    senderSignature: MinaSignature,
}

public struct ActionTransferQuoteToken has copy, drop {
    senderPublicKey: MinaPublicKey,
    receiverPublicKey: MinaPublicKey,
    amount: u64,
    senderNonce: u64,
    receiverNonce: u64,
    senderSignature: MinaSignature,
}

public struct Operation has copy, drop {
    operation: u8,
    sequence: u64,
    pool: String,
    poolPublicKey: MinaPublicKey,
    actionState: vector<u8>,
    data: vector<vector<u8>>,
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

public struct OperationTransferBaseTokenEvent has copy, drop {
    operation: Operation,
    details: ActionTransferBaseToken,
}

public struct OperationTransferQuoteTokenEvent has copy, drop {
    operation: Operation,
    details: ActionTransferQuoteToken,
}

public struct Pool has key, store {
    id: UID,
    name: String,
    publicKey: MinaPublicKey,
    baseToken: Token,
    quoteToken: Token,
    accounts: VecMap<MinaPublicKey, UserTradingAccount>,
}

public struct PoolCreateEvent has copy, drop {
    id: ID,
    address: address,
    name: String,
    publicKey: MinaPublicKey,
    baseToken: Token,
    quoteToken: Token,
}

#[allow(unused_field)]
public struct Block has key, store {
    id: UID,
    blockNumber: u64,
    sequences: vector<u64>,
    startActionState: vector<u8>,
    endActionState: vector<u8>,
    stateDataAvailability: Option<String>,
    proofDataAvailability: Option<String>,
}

public struct BlockEvent has copy, drop {
    id: ID,
    blockNumber: u64,
    sequences: vector<u64>,
    startActionState: vector<u8>,
    endActionState: vector<u8>,
    stateDataAvailability: Option<String>,
    proofDataAvailability: Option<String>,
}

public struct DEX has key, store {
    id: UID,
    admin: address,
    public_key: vector<u8>,
    version: u32,
    actionsState: vector<u8>,
    sequence: u64,
    previous_block_sequence: u64,
    previous_block_actions_state: vector<u8>,
    block_number: u64,
    poolId: Option<ID>,
    poolAddress: Option<address>,
    isPaused: bool,
}

public struct DEXCreateEvent has copy, drop {
    id: ID,
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

fun init(ctx: &mut TxContext) {
    let bytes = vector<u8>[0];
    let hash = blake2b256(&bytes);
    let dex = DEX {
        id: object::new(ctx),
        admin: ctx.sender(),
        public_key: vector::empty<u8>(),
        version: DEX_VERSION,
        actionsState: hash,
        sequence: 0,
        previous_block_sequence: 0,
        previous_block_actions_state: hash,
        block_number: 0,
        poolId: option::none(),
        poolAddress: option::none(),
        isPaused: true,
    };

    event::emit(DEXCreateEvent {
        id: dex.id.to_inner(),
        admin: dex.admin,
        version: dex.version,
        actionsState: dex.actionsState,
    });
    transfer::share_object(dex);
}

fun update_actions_state(
    dex: &mut DEX,
    operation: u8,
    data: vector<vector<u8>>,
    pool: String,
    poolPublicKey: MinaPublicKey,
): Operation {
    assert!(dex.isPaused == false, EDEXPaused);
    let mut dataToHash = vector::empty<u8>();
    vector::append(&mut dataToHash, dex.actionsState);
    vector::push_back(&mut dataToHash, operation);
    let mut i = 0;
    while (i < vector::length(&data)) {
        vector::append(&mut dataToHash, *vector::borrow(&data, i));
        i = i + 1;
    };
    let hash = blake2b256(&dataToHash);
    dex.actionsState = hash;
    dex.sequence = dex.sequence + 1;
    Operation {
        operation,
        sequence: dex.sequence,
        actionState: hash,
        data,
        pool,
        poolPublicKey,
    }
}

public fun public_key(publicKey: MinaPublicKey) {
    event::emit(MinaPublicKey {
        x: publicKey.x,
        isOdd: publicKey.isOdd,
    });
}

public struct NumEvent has copy, drop {
    num1: u256,
    num2: u256,
}

public fun num_event(num: NumEvent) {
    event::emit(NumEvent {
        num1: num.num1,
        num2: num.num2,
    });
}

public fun create_pool(
    dex: &mut DEX,
    name: String,
    publicKey: MinaPublicKey,
    baseToken: Token,
    quoteToken: Token,
    ctx: &mut TxContext,
): address {
    assert!((dex.admin == ctx.sender()), ENotAuthorized);
    let pool = Pool {
        id: object::new(ctx),
        name,
        publicKey,
        baseToken,
        quoteToken,
        accounts: empty<MinaPublicKey, UserTradingAccount>(),
    };
    let address = pool.id.to_address();
    let poolId = pool.id.to_inner();

    dex.poolId = option::some(poolId);
    dex.poolAddress = option::some(address);

    event::emit(PoolCreateEvent {
        id: pool.id.to_inner(),
        address,
        name: pool.name,
        publicKey: pool.publicKey,
        baseToken: pool.baseToken,
        quoteToken: pool.quoteToken,
    });
    transfer::share_object(pool);
    address
}

public fun create_account(
    dex: &mut DEX,
    pool: &mut Pool,
    publicKey: MinaPublicKey,
    name: String,
    base58PublicKey: String,
    baseBalance: u64,
    quoteBalance: u64,
    ctx: &mut TxContext,
) {
    assert!(dex.isPaused == false, EDEXPaused);
    assert!((dex.admin == ctx.sender()), ENotAuthorized);
    let account = UserTradingAccount {
        name,
        base58PublicKey,
        baseTokenBalance: MinaBalance {
            amount: baseBalance,
            borrowedAmount: 0,
        },
        quoteTokenBalance: MinaBalance {
            amount: quoteBalance,
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
    let data: vector<vector<u8>> = vector[
        publicKey.to_bytes(),
        pool.publicKey.to_bytes(),
        std::bcs::to_bytes(&baseBalance),
        std::bcs::to_bytes(&quoteBalance),
    ];
    let operation = update_actions_state(dex, operation, data, pool.name, pool.publicKey);

    event::emit(OperationCreateAccountEvent {
        operation,
        details: ActionCreateAccount {
            name,
            base58PublicKey,
            userPublicKey: publicKey,
            poolPublicKey: pool.publicKey,
            baseBalance,
            quoteBalance,
        },
    });
}

public fun bid(
    dex: &mut DEX,
    pool: &mut Pool,
    publicKey: MinaPublicKey,
    amount: u64,
    price: u64,
    userSignature: MinaSignature,
    validatorSignature: vector<u8>,
) {
    assert!(dex.isPaused == false, EDEXPaused);
    let account = pool.accounts.get_mut(&publicKey);
    let operation = OPERATION_BID;
    let signatureData = vector<u256>[
        operation as u256,
        account.nonce as u256,
        amount as u256,
        price as u256,
    ];
    let valid = verify_signature(
        dex,
        validatorSignature,
        publicKey,
        pool.publicKey,
        userSignature,
        account.nonce,
        signatureData,
    );
    assert!(valid, EInvalidSignature);
    account.bid.amount = amount;
    account.bid.price = price;
    account.bid.isSome = amount != 0 && price != 0;
    account.nonce = account.nonce + 1;

    let data: vector<vector<u8>> = vector[
        publicKey.to_bytes(),
        pool.publicKey.to_bytes(),
        std::bcs::to_bytes(&amount),
        std::bcs::to_bytes(&price),
        std::bcs::to_bytes(&account.nonce),
    ];
    let operation = update_actions_state(dex, operation, data, pool.name, pool.publicKey);

    event::emit(OperationBidEvent {
        operation,
        details: ActionBid {
            userPublicKey: publicKey,
            poolPublicKey: pool.publicKey,
            amount,
            price,
            userSignature,
            isSome: account.bid.isSome,
            nonce: account.nonce,
        },
    });
}

public fun ask(
    dex: &mut DEX,
    pool: &mut Pool,
    publicKey: MinaPublicKey,
    amount: u64,
    price: u64,
    userSignature: MinaSignature,
    validatorSignature: vector<u8>,
) {
    assert!(dex.isPaused == false, EDEXPaused);
    let account = pool.accounts.get_mut(&publicKey);
    let operation = OPERATION_ASK;
    let signatureData = vector<u256>[
        operation as u256,
        account.nonce as u256,
        amount as u256,
        price as u256,
    ];
    let valid = verify_signature(
        dex,
        validatorSignature,
        publicKey,
        pool.publicKey,
        userSignature,
        account.nonce,
        signatureData,
    );
    assert!(valid, EInvalidSignature);
    account.ask.amount = amount;
    account.ask.price = price;
    account.ask.isSome = amount != 0 && price != 0;
    account.nonce = account.nonce + 1;

    let data: vector<vector<u8>> = vector[
        publicKey.to_bytes(),
        pool.publicKey.to_bytes(),
        std::bcs::to_bytes(&amount),
        std::bcs::to_bytes(&price),
        std::bcs::to_bytes(&account.nonce),
    ];
    let operation = update_actions_state(dex, operation, data, pool.name, pool.publicKey);

    event::emit(OperationAskEvent {
        operation,
        details: ActionAsk {
            userPublicKey: publicKey,
            poolPublicKey: pool.publicKey,
            amount,
            price,
            isSome: account.ask.isSome,
            nonce: account.nonce,
            userSignature,
        },
    });
}

public fun trade(
    dex: &mut DEX,
    pool: &mut Pool,
    buyerPublicKey: MinaPublicKey,
    sellerPublicKey: MinaPublicKey,
    amount: u64,
    price: u64,
) {
    assert!(dex.isPaused == false, EDEXPaused);
    let quoteAmount = ((amount as u128) * (price as u128) / 1_000_000_000u128) as u64;

    // Handle buyer first
    let buyerNonce;
    {
        let buyerAccount = pool.accounts.get_mut(&buyerPublicKey);
        assert!(buyerAccount.ask.isSome, EInvalidAsk);
        assert!(buyerAccount.ask.amount >= amount, EInsufficientAsk);
        assert!(buyerAccount.ask.price <= price, EInvalidAskPrice);
        buyerAccount.ask.amount = buyerAccount.ask.amount - amount;
        buyerAccount.baseTokenBalance.amount = buyerAccount.baseTokenBalance.amount + amount;
        buyerAccount.quoteTokenBalance.amount = buyerAccount.quoteTokenBalance.amount - quoteAmount;
        buyerAccount.nonce = buyerAccount.nonce + 1;
        buyerNonce = buyerAccount.nonce;
    };

    // Handle seller separately
    let sellerNonce;
    {
        let sellerAccount = pool.accounts.get_mut(&sellerPublicKey);
        assert!(sellerAccount.bid.isSome, EInvalidBid);
        assert!(sellerAccount.bid.amount >= amount, EInsufficientBid);
        assert!(sellerAccount.bid.price >= price, EInvalidBidPrice);
        sellerAccount.bid.amount = sellerAccount.bid.amount - amount;
        sellerAccount.baseTokenBalance.amount = sellerAccount.baseTokenBalance.amount - amount;
        sellerAccount.quoteTokenBalance.amount =
            sellerAccount.quoteTokenBalance.amount + quoteAmount;
        sellerAccount.nonce = sellerAccount.nonce + 1;
        sellerNonce = sellerAccount.nonce;
    };

    let operation = OPERATION_TRADE;
    let data: vector<vector<u8>> = vector[
        buyerPublicKey.to_bytes(),
        sellerPublicKey.to_bytes(),
        pool.publicKey.to_bytes(),
        std::bcs::to_bytes(&amount),
        std::bcs::to_bytes(&quoteAmount),
        std::bcs::to_bytes(&price),
        std::bcs::to_bytes(&buyerNonce),
        std::bcs::to_bytes(&sellerNonce),
    ];
    let operation = update_actions_state(dex, operation, data, pool.name, pool.publicKey);

    event::emit(OperationTradeEvent {
        operation,
        details: ActionTrade {
            buyerPublicKey,
            sellerPublicKey,
            poolPublicKey: pool.publicKey,
            amount,
            quoteAmount,
            price,
            buyerNonce,
            sellerNonce,
        },
    });
}

public fun transferBaseToken(
    dex: &mut DEX,
    pool: &mut Pool,
    senderPublicKey: MinaPublicKey,
    receiverPublicKey: MinaPublicKey,
    amount: u64,
    senderSignature: MinaSignature,
    validatorSignature: vector<u8>,
) {
    assert!(dex.isPaused == false, EDEXPaused);
    let operation = OPERATION_TRANSFER_BASE_TOKEN;
    let senderNonce;
    {
        let senderAccount = pool.accounts.get_mut(&senderPublicKey);
        assert!(senderAccount.baseTokenBalance.amount >= amount, EInsufficientSenderBalance);
        assert!(senderAccount.baseTokenBalance.borrowedAmount == 0, ECannotTransferBorrowedAmount);
        assert!(senderAccount.quoteTokenBalance.borrowedAmount == 0, ECannotTransferBorrowedAmount);
        let signatureData = vector<u256>[
            operation as u256,
            senderAccount.nonce as u256,
            amount as u256,
            receiverPublicKey.x as u256,
            bool_to_u256(receiverPublicKey.isOdd),
        ];
        let valid = verify_signature(
            dex,
            validatorSignature,
            senderPublicKey,
            pool.publicKey,
            senderSignature,
            senderAccount.nonce,
            signatureData,
        );
        assert!(valid, EInvalidSignature);
        senderAccount.baseTokenBalance.amount = senderAccount.baseTokenBalance.amount - amount;
        senderAccount.nonce = senderAccount.nonce + 1;
        senderNonce = senderAccount.nonce;
    };

    // Handle seller separately
    let receiverNonce;
    {
        let receiverAccount = pool.accounts.get_mut(&receiverPublicKey);
        receiverAccount.baseTokenBalance.amount = receiverAccount.baseTokenBalance.amount + amount;
        receiverAccount.nonce = receiverAccount.nonce + 1;
        receiverNonce = receiverAccount.nonce;
    };

    let data: vector<vector<u8>> = vector[
        senderPublicKey.to_bytes(),
        receiverPublicKey.to_bytes(),
        pool.publicKey.to_bytes(),
        std::bcs::to_bytes(&amount),
        std::bcs::to_bytes(&senderNonce),
        std::bcs::to_bytes(&receiverNonce),
    ];
    let operation = update_actions_state(dex, operation, data, pool.name, pool.publicKey);

    event::emit(OperationTransferBaseTokenEvent {
        operation,
        details: ActionTransferBaseToken {
            senderPublicKey,
            receiverPublicKey,
            amount,
            senderNonce,
            receiverNonce,
            senderSignature,
        },
    });
}

public fun transferQuoteToken(
    dex: &mut DEX,
    pool: &mut Pool,
    senderPublicKey: MinaPublicKey,
    receiverPublicKey: MinaPublicKey,
    amount: u64,
    senderSignature: MinaSignature,
    validatorSignature: vector<u8>,
) {
    assert!(dex.isPaused == false, EDEXPaused);
    let operation = OPERATION_TRANSFER_QUOTE_TOKEN;
    let senderNonce;
    {
        let senderAccount = pool.accounts.get_mut(&senderPublicKey);
        assert!(senderAccount.quoteTokenBalance.amount >= amount, EInsufficientSenderBalance);
        assert!(senderAccount.quoteTokenBalance.borrowedAmount == 0, ECannotTransferBorrowedAmount);
        assert!(senderAccount.baseTokenBalance.borrowedAmount == 0, ECannotTransferBorrowedAmount);
        let signatureData = vector<u256>[
            operation as u256,
            senderAccount.nonce as u256,
            amount as u256,
            receiverPublicKey.x as u256,
            bool_to_u256(receiverPublicKey.isOdd),
        ];
        let valid = verify_signature(
            dex,
            validatorSignature,
            senderPublicKey,
            pool.publicKey,
            senderSignature,
            senderAccount.nonce,
            signatureData,
        );
        assert!(valid, EInvalidSignature);
        senderAccount.quoteTokenBalance.amount = senderAccount.quoteTokenBalance.amount - amount;
        senderAccount.nonce = senderAccount.nonce + 1;
        senderNonce = senderAccount.nonce;
    };

    // Handle seller separately
    let receiverNonce;
    {
        let receiverAccount = pool.accounts.get_mut(&receiverPublicKey);
        receiverAccount.baseTokenBalance.amount = receiverAccount.baseTokenBalance.amount + amount;
        receiverAccount.nonce = receiverAccount.nonce + 1;
        receiverNonce = receiverAccount.nonce;
    };

    let data: vector<vector<u8>> = vector[
        senderPublicKey.to_bytes(),
        receiverPublicKey.to_bytes(),
        pool.publicKey.to_bytes(),
        std::bcs::to_bytes(&amount),
        std::bcs::to_bytes(&senderNonce),
        std::bcs::to_bytes(&receiverNonce),
    ];
    let operation = update_actions_state(dex, operation, data, pool.name, pool.publicKey);

    event::emit(OperationTransferQuoteTokenEvent {
        operation,
        details: ActionTransferQuoteToken {
            senderPublicKey,
            receiverPublicKey,
            amount,
            senderNonce,
            receiverNonce,
            senderSignature,
        },
    });
}

#[allow(lint(self_transfer))]
public fun create_block(dex: &mut DEX, ctx: &mut TxContext) {
    assert!(dex.admin == ctx.sender(), ENotAuthorized);
    let blockNumber = dex.block_number + 1;
    let mut sequences = vector::empty<u64>();
    let mut i = dex.previous_block_sequence + 1;
    while (i <= dex.sequence) {
        vector::push_back(&mut sequences, i);
        i = i + 1;
    };
    let block = Block {
        // TODO: add timestamp
        id: object::new(ctx),
        blockNumber,
        sequences,
        startActionState: dex.previous_block_actions_state,
        endActionState: dex.actionsState,
        stateDataAvailability: option::none(),
        proofDataAvailability: option::none(),
    };

    dex.previous_block_sequence = dex.sequence;
    dex.previous_block_actions_state = dex.actionsState;
    dex.block_number = blockNumber;
    event::emit(BlockEvent {
        id: block.id.to_inner(),
        blockNumber,
        sequences,
        startActionState: block.startActionState,
        endActionState: block.endActionState,
        stateDataAvailability: option::none(),
        proofDataAvailability: option::none(),
    });

    transfer::transfer(block, ctx.sender());
    //transfer::share_object(block);
}

public fun update_block_state(block: &mut Block, block_state: String) {
    block.stateDataAvailability = option::some(block_state);
    event::emit(BlockEvent {
        id: block.id.to_inner(),
        blockNumber: block.blockNumber,
        sequences: block.sequences,
        startActionState: block.startActionState,
        endActionState: block.endActionState,
        stateDataAvailability: block.stateDataAvailability,
        proofDataAvailability: block.proofDataAvailability,
    });
}

public fun update_block_proof(block: &mut Block, block_proof: String) {
    block.proofDataAvailability = option::some(block_proof);
    event::emit(BlockEvent {
        id: block.id.to_inner(),
        blockNumber: block.blockNumber,
        sequences: block.sequences,
        startActionState: block.startActionState,
        endActionState: block.endActionState,
        stateDataAvailability: block.stateDataAvailability,
        proofDataAvailability: block.proofDataAvailability,
    });
}

public fun set_public_key(dex: &mut DEX, public_key: vector<u8>, ctx: &mut TxContext) {
    assert!(dex.admin == ctx.sender(), ENotAuthorized);
    assert!(vector::length(&public_key) == 33, EInvalidPublicKey);
    dex.public_key = public_key;
    dex.isPaused = false;
}

public fun verify_signature(
    dex: &DEX,
    signature: vector<u8>,
    accountPublicKey: MinaPublicKey,
    poolPublicKey: MinaPublicKey,
    minaSignature: MinaSignature,
    nonce: u64,
    data: vector<u256>,
): bool {
    let public_key = dex.public_key;
    assert!(vector::length(&public_key) == 33, EInvalidPublicKey);
    let mut msg = vector::empty<u8>();
    vector::append(&mut msg, accountPublicKey.to_bytes());
    vector::append(&mut msg, poolPublicKey.to_bytes());
    vector::append(&mut msg, minaSignature.to_bytes());
    vector::append(&mut msg, std::bcs::to_bytes(&nonce));
    let mut i = 0;
    while (i < vector::length(&data)) {
        vector::append(&mut msg, std::bcs::to_bytes(&*vector::borrow(&data, i)));
        i = i + 1;
    };
    let hash: u8 = 1;
    let valid = secp256k1_verify(&signature, &public_key, &msg, hash);
    assert!(valid, EInvalidSignature);
    valid
}
