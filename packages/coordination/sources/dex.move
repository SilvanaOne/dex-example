module dex::main;

use dex::admin::{Admin, create_admin, get_admin_address};
use dex::pool::{Self, Pool};
use dex::prover::{
    Circuit,
    create_circuit,
    create_block_proof_calculation,
    get_proof_calculation_address,
    request_proof_calculation,
    ProofCalculation
};
use dex::token::{Self, Token};
use dex::user::{User, UserTradingAccount};
use std::string::String;
use sui::clock::{timestamp_ms, Clock};
use sui::display;
use sui::event;
use sui::hash::blake2b256;
use sui::object_table;
use sui::package;
use sui::vec_map::VecMap;

const DEX_VERSION: u32 = 1;

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
    block_state: BlockState,
    block_state_address: address,
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
    proof_calculation_address: address,
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
    proof_calculation: address,
}

public struct DataAvailabilityEvent has copy, drop {
    block_number: u64,
    state_data_availability: Option<String>,
    proof_data_availability: Option<String>,
}

public struct DEX has key, store {
    id: UID,
    name: String,
    admin: address,
    public_key: vector<u8>,
    circuit: Circuit,
    circuit_address: address,
    pool: Pool,
    proof_calculations: object_table::ObjectTable<u64, ProofCalculation>,
    version: u32,
    actionsState: vector<u8>,
    sequence: u64,
    previous_block_timestamp: u64,
    previous_block_sequence: u64,
    previous_block_actions_state: vector<u8>,
    block_number: u64,
    last_block_address: address,
    isPaused: bool,
}

public struct DEXCreateEvent has copy, drop {
    address: address,
    admin: address,
    version: u32,
    actionsState: vector<u8>,
    timestamp: u64,
}

public struct MAIN has drop {}

fun init(otw: MAIN, ctx: &mut TxContext) {
    create_admin(ctx);

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
}

public fun create_dex(
    admin: &Admin,
    public_key: vector<u8>,
    // Circuit
    circuit_name: String,
    circuit_description: String,
    circuit_package_da_hash: String,
    circuit_verification_key_hash: u256,
    circuit_verification_key_data: String,
    // Token 1
    base_token_publicKey: u256,
    base_token_publicKeyBase58: String,
    base_token_tokenId: u256,
    base_token_token: String,
    base_token_name: String,
    base_token_description: String,
    base_token_image: String,
    // Token 2
    quote_token_publicKey: u256,
    quote_token_publicKeyBase58: String,
    quote_token_tokenId: u256,
    quote_token_token: String,
    quote_token_name: String,
    quote_token_description: String,
    quote_token_image: String,
    // Pool
    pool_name: String,
    pool_publicKey: u256,
    pool_publicKeyBase58: String,
    initial_price: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(get_admin_address(admin) == ctx.sender(), ENotAuthorized);
    let timestamp = clock.timestamp_ms();
    let bytes = vector<u8>[0];
    let hash = blake2b256(&bytes);
    let (circuit, circuit_address) = create_circuit(
        circuit_name,
        circuit_description,
        circuit_package_da_hash,
        circuit_verification_key_hash,
        circuit_verification_key_data,
        clock,
        ctx,
    );
    let (base_token, base_token_event) = token::create_token(
        admin,
        base_token_publicKey,
        base_token_publicKeyBase58,
        base_token_tokenId,
        base_token_token,
        base_token_name,
        base_token_description,
        base_token_image,
        ctx,
    );
    let (quote_token, quote_token_event) = token::create_token(
        admin,
        quote_token_publicKey,
        quote_token_publicKeyBase58,
        quote_token_tokenId,
        quote_token_token,
        quote_token_name,
        quote_token_description,
        quote_token_image,
        ctx,
    );
    let pool = pool::create_pool(
        admin,
        pool_name,
        pool_publicKey,
        pool_publicKeyBase58,
        base_token,
        quote_token,
        base_token_event,
        quote_token_event,
        initial_price,
        clock,
        ctx,
    );

    let (
        proof_calculation_block_0,
        proof_calculation_block_0_address,
    ) = create_block_proof_calculation(
        0u64,
        circuit_address,
        option::some<vector<u64>>(vector<u64>[]),
        clock,
        ctx,
    );

    let (block_address, block_timestamp) = create_block_internal(
        admin,
        0u64,
        vector<u64>[],
        &pool,
        hash,
        vector<u8>[],
        proof_calculation_block_0_address,
        option::none(),
        option::none(),
        clock,
        ctx,
    );

    let (proof_calculation_block_1, _) = create_block_proof_calculation(
        1u64,
        circuit_address,
        option::none<vector<u64>>(),
        clock,
        ctx,
    );
    let mut proof_calculations = object_table::new<u64, ProofCalculation>(ctx);
    proof_calculations.add(0u64, proof_calculation_block_0);
    proof_calculations.add(1u64, proof_calculation_block_1);

    let dex = DEX {
        id: object::new(ctx),
        name: b"Silvana DEX".to_string(),
        pool,
        admin: ctx.sender(),
        public_key,
        circuit,
        circuit_address,
        version: DEX_VERSION,
        actionsState: hash,
        sequence: 1u64,
        previous_block_sequence: 0u64,
        previous_block_timestamp: block_timestamp,
        previous_block_actions_state: hash,
        block_number: 1u64,
        isPaused: false,
        last_block_address: block_address,
        proof_calculations,
    };

    event::emit(DEXCreateEvent {
        address: dex.id.to_address(),
        admin: dex.admin,
        version: dex.version,
        actionsState: dex.actionsState,
        timestamp,
    });

    transfer::share_object(dex);
}

// Error codes
#[error]
const ENotAuthorized: vector<u8> = b"Not authorized";

public(package) fun only_admin(dex: &DEX, ctx: &TxContext) {
    assert!(dex.admin == ctx.sender(), ENotAuthorized);
}

#[error]
const EDEXPaused: vector<u8> = b"DEX is paused";

public(package) fun not_paused(dex: &DEX) {
    assert!(dex.isPaused == false, EDEXPaused);
}

public(package) fun insert_account_to_pool(
    dex: &mut DEX,
    publicKey: u256,
    account: UserTradingAccount,
) {
    pool::insert_account(&mut dex.pool, publicKey, account);
}

public(package) fun get_public_key(dex: &DEX): vector<u8> {
    dex.public_key
}

public(package) fun get_dex_state(dex: &DEX): (vector<u8>, u64, u64, vector<u8>, String, u256) {
    (
        dex.public_key,
        dex.sequence,
        dex.block_number,
        dex.actionsState,
        pool::get_name(&dex.pool),
        pool::get_public_key(&dex.pool),
    )
}

public(package) fun get_pool_account(dex: &mut DEX, publicKey: u256): &mut UserTradingAccount {
    pool::get_account(&mut dex.pool, publicKey)
}

public(package) fun update_actions_state(dex: &mut DEX, operation: u8, actionState: vector<u8>) {
    assert!(dex.isPaused == false, EDEXPaused);
    let proof_calculation = object_table::borrow_mut(&mut dex.proof_calculations, dex.block_number);
    request_proof_calculation(proof_calculation, operation, dex.sequence);
    dex.actionsState = actionState;
    dex.sequence = dex.sequence + 1;
}

public(package) fun update_pool_last_price(dex: &mut DEX, last_price: u64) {
    pool::update_last_price(&mut dex.pool, last_price);
}

public fun create_block(admin: &Admin, dex: &mut DEX, clock: &Clock, ctx: &mut TxContext) {
    dex.only_admin(ctx);
    let mut block_number = dex.block_number;
    let mut sequences = vector<u64>[];
    let mut i = dex.previous_block_sequence + 1;
    while (i < dex.sequence) {
        vector::push_back(&mut sequences, i);
        i = i + 1;
    };
    let (address, timestamp) = create_block_internal(
        admin,
        block_number,
        sequences,
        &dex.pool,
        dex.actionsState,
        dex.previous_block_actions_state,
        get_proof_calculation_address(
            object_table::borrow(&dex.proof_calculations, block_number),
        ),
        option::some(dex.last_block_address),
        option::some(dex.previous_block_timestamp),
        clock,
        ctx,
    );
    block_number = block_number + 1;
    let (proof_calculation, _) = create_block_proof_calculation(
        block_number,
        dex.circuit_address,
        option::none(),
        clock,
        ctx,
    );
    dex.block_number = block_number;
    dex.last_block_address = address;
    dex.previous_block_timestamp = timestamp;
    dex.previous_block_actions_state = dex.actionsState;
    object_table::add(&mut dex.proof_calculations, block_number, proof_calculation);
}

#[allow(lint(self_transfer))]
public(package) fun create_block_internal(
    admin: &Admin,
    block_number: u64,
    sequences: vector<u64>,
    pool: &Pool,
    actions_state: vector<u8>,
    previous_block_actions_state: vector<u8>,
    proof_calculation_address: address,
    previous_block_address: Option<address>,
    previous_block_timestamp: Option<u64>,
    clock: &Clock,
    ctx: &mut TxContext,
): (address, u64) {
    assert!(get_admin_address(admin) == ctx.sender(), ENotAuthorized);
    let timestamp = clock.timestamp_ms();
    let mut name: String = b"Silvana DEX Block ".to_string();
    name.append(block_number.to_string());
    let mut block_state_name: String = b"Silvana DEX Block ".to_string();
    block_state_name.append(block_number.to_string());
    block_state_name.append(b" State".to_string());
    let block_state = BlockState {
        id: object::new(ctx),
        name: block_state_name,
        block_number: block_number,
        state: pool.get_accounts(),
    };
    let block_state_address = block_state.id.to_address();

    let time_since_last_block = if (previous_block_timestamp.is_some()) {
        timestamp - *previous_block_timestamp.borrow()
    } else {
        0u64
    };
    let block_id = object::new(ctx);
    let block_address = block_id.to_address();

    let block = Block {
        id: block_id,
        name,
        block_number,
        block_state,
        block_state_address,
        timestamp,
        time_since_last_block,
        number_of_transactions: vector::length(&sequences),
        sequences,
        start_action_state: previous_block_actions_state,
        end_action_state: actions_state,
        state_data_availability: option::none(),
        proof_data_availability: option::none(),
        mina_tx_hash: option::none(),
        mina_tx_included_in_block: option::none(),
        previous_block_address,
        proof_calculation_address,
    };

    event::emit(BlockEvent {
        address: block.id.to_address(),
        block_number,
        name,
        timestamp,
        block_state: block_state_address,
        previous_block_address,
        time_since_last_block,
        number_of_transactions: vector::length(&sequences),
        sequences,
        start_action_state: previous_block_actions_state,
        end_action_state: actions_state,
        state_data_availability: block.state_data_availability,
        proof_data_availability: option::none(),
        proof_calculation: proof_calculation_address,
    });
    transfer::transfer(block, ctx.sender());
    (block_address, timestamp)
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
        block_state: block.block_state_address,
        previous_block_address: block.previous_block_address,
        time_since_last_block: block.time_since_last_block,
        number_of_transactions: vector::length(&block.sequences),
        sequences: block.sequences,
        start_action_state: block.start_action_state,
        end_action_state: block.end_action_state,
        state_data_availability: block.state_data_availability,
        proof_data_availability: block.proof_data_availability,
        proof_calculation: block.proof_calculation_address,
    });
    event::emit(DataAvailabilityEvent {
        block_number: block.block_number,
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
        block_state: block.block_state_address,
        previous_block_address: block.previous_block_address,
        time_since_last_block: block.time_since_last_block,
        number_of_transactions: vector::length(&block.sequences),
        sequences: block.sequences,
        start_action_state: block.start_action_state,
        end_action_state: block.end_action_state,
        state_data_availability: block.state_data_availability,
        proof_data_availability: block.proof_data_availability,
        proof_calculation: block.proof_calculation_address,
    });
    event::emit(DataAvailabilityEvent {
        block_number: block.block_number,
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
        block_state: block.block_state_address,
        previous_block_address: block.previous_block_address,
        time_since_last_block: block.time_since_last_block,
        number_of_transactions: vector::length(&block.sequences),
        sequences: block.sequences,
        start_action_state: block.start_action_state,
        end_action_state: block.end_action_state,
        state_data_availability: block.state_data_availability,
        proof_data_availability: block.proof_data_availability,
        proof_calculation: block.proof_calculation_address,
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
        block_state: block.block_state_address,
        previous_block_address: block.previous_block_address,
        time_since_last_block: block.time_since_last_block,
        number_of_transactions: vector::length(&block.sequences),
        sequences: block.sequences,
        start_action_state: block.start_action_state,
        end_action_state: block.end_action_state,
        state_data_availability: block.state_data_availability,
        proof_data_availability: block.proof_data_availability,
        proof_calculation: block.proof_calculation_address,
    });
}
