module dex::main;

use dex::admin::{Admin, get_admin_address};
use dex::pool::{Self, Pool};
use dex::prover;
use dex::token;
use dex::user::UserTradingAccount;
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
    sequence: u64,
    state: VecMap<u256, UserTradingAccount>,
}

public struct Block has key, store {
    id: UID,
    name: String,
    block_number: u64,
    start_sequence: u64,
    end_sequence: u64,
    block_state: BlockState,
    block_state_address: address,
    time_since_last_block: u64,
    number_of_transactions: u64,
    start_action_state: vector<u8>,
    end_action_state: vector<u8>,
    state_data_availability: Option<String>,
    proof_data_availability: Option<String>,
    mina_tx_hash: Option<String>,
    mina_tx_included_in_block: bool,
    previous_block_address: Option<address>,
    proof_calculation_address: address,
    created_at: u64,
    state_calculated_at: Option<u64>,
    proved_at: Option<u64>,
    sent_to_mina_at: Option<u64>,
    settled_on_mina_at: Option<u64>,
}

public struct BlockEvent has copy, drop {
    address: address,
    name: String,
    block_number: u64,
    start_sequence: u64,
    end_sequence: u64,
    timestamp: u64,
    block_state: address,
    previous_block_address: Option<address>,
    time_since_last_block: u64,
    number_of_transactions: u64,
    start_action_state: vector<u8>,
    end_action_state: vector<u8>,
    proof_calculation: address,
}

public struct DataAvailabilityEvent has copy, drop {
    block_number: u64,
    state_data_availability: Option<String>,
    proof_data_availability: Option<String>,
    state_calculated_at: u64,
    proof_calculated_at: Option<u64>,
}

public struct MinaTransactionEvent has copy, drop {
    block_number: u64,
    mina_tx_hash: String,
    mina_tx_included_in_block: bool,
    sent_to_mina_at: u64,
    settled_on_mina_at: Option<u64>,
}

public struct DEX has key, store {
    id: UID,
    name: String,
    sequence: u64,
    block_number: u64,
    actionsState: vector<u8>,
    proof_calculations: object_table::ObjectTable<u64, prover::ProofCalculation>,
    admin: address,
    public_key: vector<u8>,
    circuit: prover::Circuit,
    circuit_address: address,
    pool: Pool,
    version: u32,
    previous_block_timestamp: u64,
    previous_block_last_sequence: u64,
    previous_block_actions_state: vector<u8>,
    previous_block_address: address,
    last_proved_block_number: u64,
    last_proved_sequence: u64,
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
    display_block.update_version();
    transfer::public_transfer(publisher, ctx.sender());
    transfer::public_transfer(display_dex, ctx.sender());
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
    let (circuit, circuit_address) = prover::create_circuit(
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
    ) = prover::create_block_proof_calculation(
        0u64,
        circuit_address,
        0u64,
        option::some(0u64),
        clock,
        ctx,
    );

    let (block_address, block_timestamp) = create_block_internal(
        admin,
        0u64,
        0u64,
        0u64,
        &pool,
        hash,
        vector<u8>[],
        proof_calculation_block_0_address,
        option::none(),
        option::none(),
        clock,
        ctx,
    );

    let (proof_calculation_block_1, _) = prover::create_block_proof_calculation(
        1u64,
        circuit_address,
        1u64,
        option::none(),
        clock,
        ctx,
    );
    let mut proof_calculations = object_table::new<u64, prover::ProofCalculation>(ctx);
    proof_calculations.add(0u64, proof_calculation_block_0);
    proof_calculations.add(1u64, proof_calculation_block_1);

    let dex = DEX {
        id: object::new(ctx),
        name: b"Silvana DEX".to_string(),
        sequence: 1u64,
        block_number: 1u64,
        actionsState: hash,
        proof_calculations,
        admin: ctx.sender(),
        public_key,
        circuit,
        circuit_address,
        pool,
        version: DEX_VERSION,
        previous_block_timestamp: block_timestamp,
        previous_block_last_sequence: 0u64,
        previous_block_actions_state: hash,
        previous_block_address: block_address,
        last_proved_block_number: 0u64,
        last_proved_sequence: 0u64,
        isPaused: false,
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

public(package) fun update_actions_state(dex: &mut DEX, actionState: vector<u8>) {
    assert!(dex.isPaused == false, EDEXPaused);
    dex.actionsState = actionState;
    dex.sequence = dex.sequence + 1;
}

public(package) fun update_pool_last_price(dex: &mut DEX, last_price: u64) {
    pool::update_last_price(&mut dex.pool, last_price);
}

#[error]
const ENoTransactions: vector<u8> = b"No new transactions";

public fun create_block(admin: &Admin, dex: &mut DEX, clock: &Clock, ctx: &mut TxContext) {
    assert!((dex.previous_block_last_sequence + 1) != dex.sequence, ENoTransactions);
    dex.only_admin(ctx);
    let mut block_number = dex.block_number;
    let start_sequence = dex.previous_block_last_sequence + 1;
    let end_sequence = dex.sequence - 1;
    let proof_calculation = object_table::borrow_mut(&mut dex.proof_calculations, block_number);
    let finished = prover::set_end_sequence(proof_calculation, end_sequence, clock);
    if (finished) {
        if (dex.last_proved_block_number == block_number - 1) {
            dex.last_proved_block_number = block_number;
        };
    };

    let (address, timestamp) = create_block_internal(
        admin,
        block_number,
        start_sequence,
        end_sequence,
        &dex.pool,
        dex.actionsState,
        dex.previous_block_actions_state,
        prover::get_proof_calculation_address(
            object_table::borrow(&dex.proof_calculations, block_number),
        ),
        option::some(dex.previous_block_address),
        option::some(dex.previous_block_timestamp),
        clock,
        ctx,
    );
    block_number = block_number + 1;
    let (new_proof_calculation, _) = prover::create_block_proof_calculation(
        block_number,
        dex.circuit_address,
        dex.sequence,
        option::none(),
        clock,
        ctx,
    );
    dex.block_number = block_number;
    dex.previous_block_address = address;
    dex.previous_block_timestamp = timestamp;
    dex.previous_block_actions_state = dex.actionsState;
    dex.previous_block_last_sequence = end_sequence;
    object_table::add(&mut dex.proof_calculations, block_number, new_proof_calculation);
}

public fun submit_proof(
    dex: &mut DEX,
    block_number: u64,
    sequences: vector<u64>, // should be sorted
    merged_sequences_1: vector<u64>,
    merged_sequences_2: vector<u64>,
    da_hash: String,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let proof_calculation = object_table::borrow_mut(&mut dex.proof_calculations, block_number);
    let finished = prover::submit_proof(
        proof_calculation,
        sequences,
        da_hash,
        clock,
        ctx,
    );
    if (vector::length(&merged_sequences_1) > 0) {
        prover::use_proof(proof_calculation, merged_sequences_1, clock, ctx);
    };
    if (vector::length(&merged_sequences_2) > 0) {
        prover::use_proof(proof_calculation, merged_sequences_2, clock, ctx);
    };
    if (finished) {
        let mut i = dex.last_proved_block_number + 1;
        while (i < dex.block_number) {
            let proof_calculation = object_table::borrow(&dex.proof_calculations, i);
            if (prover::is_finished(proof_calculation)) {
                dex.last_proved_block_number = i;
                let end_sequence = prover::get_proof_calculation_end_sequence(proof_calculation);
                dex.last_proved_sequence = *end_sequence.borrow();
            };
            i = i + 1;
        };
    };
}

#[allow(lint(self_transfer))]
public(package) fun create_block_internal(
    admin: &Admin,
    block_number: u64,
    start_sequence: u64,
    end_sequence: u64,
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
        sequence: end_sequence,
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
        start_sequence,
        end_sequence,
        block_state,
        block_state_address,
        time_since_last_block,
        number_of_transactions: end_sequence - start_sequence + 1,
        start_action_state: previous_block_actions_state,
        end_action_state: actions_state,
        state_data_availability: option::none(),
        proof_data_availability: option::none(),
        mina_tx_hash: option::none(),
        mina_tx_included_in_block: false,
        previous_block_address,
        proof_calculation_address,
        created_at: timestamp,
        state_calculated_at: option::none(),
        proved_at: option::none(),
        sent_to_mina_at: option::none(),
        settled_on_mina_at: option::none(),
    };

    event::emit(BlockEvent {
        address: block.id.to_address(),
        block_number,
        start_sequence,
        end_sequence,
        name,
        timestamp,
        block_state: block_state_address,
        previous_block_address,
        time_since_last_block,
        number_of_transactions: end_sequence - start_sequence + 1,
        start_action_state: previous_block_actions_state,
        end_action_state: actions_state,
        proof_calculation: proof_calculation_address,
    });
    transfer::transfer(block, ctx.sender());
    (block_address, timestamp)
}

public fun update_block_state_data_availability(
    admin: &Admin,
    block: &mut Block,
    state_data_availability: String,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(get_admin_address(admin) == ctx.sender(), ENotAuthorized);
    let timestamp = clock.timestamp_ms();
    block.state_data_availability = option::some(state_data_availability);
    block.state_calculated_at = option::some(timestamp);
    event::emit(DataAvailabilityEvent {
        block_number: block.block_number,
        state_data_availability: block.state_data_availability,
        proof_data_availability: block.proof_data_availability,
        state_calculated_at: timestamp,
        proof_calculated_at: option::none(),
    });
}

public fun update_block_proof_data_availability(
    admin: &Admin,
    block: &mut Block,
    proof_data_availability: String,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(get_admin_address(admin) == ctx.sender(), ENotAuthorized);
    let timestamp = clock.timestamp_ms();
    block.proof_data_availability = option::some(proof_data_availability);
    block.proved_at = option::some(timestamp);
    event::emit(DataAvailabilityEvent {
        block_number: block.block_number,
        state_data_availability: block.state_data_availability,
        proof_data_availability: block.proof_data_availability,
        state_calculated_at: *block.state_calculated_at.borrow(),
        proof_calculated_at: option::some(timestamp),
    });
}

public fun update_block_mina_tx_hash(
    admin: &Admin,
    block: &mut Block,
    mina_tx_hash: String,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(get_admin_address(admin) == ctx.sender(), ENotAuthorized);
    let timestamp = clock.timestamp_ms();
    block.mina_tx_hash = option::some(mina_tx_hash);
    block.sent_to_mina_at = option::some(timestamp);
    event::emit(MinaTransactionEvent {
        block_number: block.block_number,
        mina_tx_hash,
        mina_tx_included_in_block: false,
        sent_to_mina_at: timestamp,
        settled_on_mina_at: option::none(),
    });
}

public fun update_block_mina_tx_included_in_block(
    admin: &Admin,
    block: &mut Block,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(get_admin_address(admin) == ctx.sender(), ENotAuthorized);
    let timestamp = clock.timestamp_ms();
    block.mina_tx_included_in_block = true;
    block.settled_on_mina_at = option::some(timestamp);
    event::emit(MinaTransactionEvent {
        block_number: block.block_number,
        mina_tx_hash: *block.mina_tx_hash.borrow(),
        mina_tx_included_in_block: true,
        sent_to_mina_at: *block.sent_to_mina_at.borrow(),
        settled_on_mina_at: option::some(timestamp),
    });
}
