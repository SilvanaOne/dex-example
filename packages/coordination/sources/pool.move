module dex::pool;

use dex::admin::{Admin, get_admin_address};
use dex::token::{Token, TokenCreateEvent};
use dex::user::UserTradingAccount;
use std::string::String;
use sui::clock::{timestamp_ms, Clock};
use sui::event;
use sui::vec_map::{VecMap, empty};

public struct Pool has key, store {
    id: UID,
    name: String,
    publicKey: u256,
    publicKeyBase58: String,
    base_token: Token,
    quote_token: Token,
    last_price: u64,
    accounts: VecMap<u256, UserTradingAccount>,
}

public struct PoolCreateEvent has copy, drop {
    address: address,
    name: String,
    publicKey: u256,
    publicKeyBase58: String,
    base_token: TokenCreateEvent,
    quote_token: TokenCreateEvent,
    created_at: u64,
}

#[error]
const ENotAuthorized: vector<u8> = b"Not authorized";

public(package) fun create_pool(
    admin: &Admin,
    name: String,
    publicKey: u256,
    publicKeyBase58: String,
    base_token: Token,
    quote_token: Token,
    base_token_event: TokenCreateEvent,
    quote_token_event: TokenCreateEvent,
    initial_price: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): Pool {
    assert!(get_admin_address(admin) == ctx.sender(), ENotAuthorized);
    let pool = Pool {
        id: object::new(ctx),
        name,
        publicKey,
        publicKeyBase58,
        base_token,
        quote_token,
        accounts: empty<u256, UserTradingAccount>(),
        last_price: initial_price,
    };
    let pool_address = pool.id.to_address();
    let timestamp = clock.timestamp_ms();

    let pool_create_event = PoolCreateEvent {
        address: pool_address,
        name: pool.name,
        publicKey: pool.publicKey,
        publicKeyBase58: pool.publicKeyBase58,
        base_token: base_token_event,
        quote_token: quote_token_event,
        created_at: timestamp,
    };

    event::emit(pool_create_event);
    pool
}

public(package) fun insert_account(pool: &mut Pool, publicKey: u256, account: UserTradingAccount) {
    pool.accounts.insert(publicKey, account);
}

public(package) fun get_name(pool: &Pool): String {
    pool.name
}

public(package) fun get_public_key(pool: &Pool): u256 {
    pool.publicKey
}

public(package) fun get_account(pool: &mut Pool, publicKey: u256): &mut UserTradingAccount {
    pool.accounts.get_mut(&publicKey)
}

public(package) fun update_last_price(pool: &mut Pool, last_price: u64) {
    pool.last_price = last_price;
}

public(package) fun get_accounts(pool: &Pool): VecMap<u256, UserTradingAccount> {
    pool.accounts
}
