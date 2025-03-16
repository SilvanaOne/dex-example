module dex::prover;

use std::string::String;
use sui::clock::Clock;
use sui::event;
use sui::vec_map::{VecMap, get, insert, get_mut, empty};

#[allow(unused_field)]
public struct Circuit has key, store {
    id: UID,
    name: String,
    description: String,
    package_da_hash: String,
    verification_key_hash: u256,
    verification_key_data: String,
    created_at: u64,
}

#[allow(unused_field)]
public struct Proof has copy, drop, store {
    publicInput: vector<u256>,
    publicOutput: vector<u256>,
    maxProofsVerified: u8, // should be 2
    proof: vector<u8>,
}

#[error]
const EInvalidMaxProofsVerified: vector<u8> = b"Invalid max proofs verified";

const PROOF_STATUS_NOT_STARTED: u8 = 0;
const PROOF_STATUS_IN_PROGRESS: u8 = 1;
const PROOF_STATUS_CALCULATED: u8 = 2;
const PROOF_STATUS_USED: u8 = 3;
const PROOF_STATUS_FAILED: u8 = 4;
const PROOF_STATUS_REJECTED: u8 = 5;
const PROOF_STATUS_ABANDONED: u8 = 6;

const MAX_PROOF_RETRIES: u8 = 3;

const OPERATION_MERGE: u8 = 100;
//const OPERATION_SETTLE: u8 = 101;

public struct ProofStatus has copy, drop, store {
    status: u8,
    timestamp: Option<u64>,
    number_of_retries: u8,
    is_merge_proof: bool,
    sequence: Option<u64>,
    operation: u8,
    input1: Option<vector<u64>>,
    input2: Option<vector<u64>>,
    proof: Option<Proof>,
    prover: Option<address>,
}

#[allow(unused_field)]
public struct ProofEvent has copy, drop {
    block_number: u64,
    sequences: vector<u64>,
    prover: address,
    proof: Proof,
    timestamp: u64,
}

#[allow(unused_field)]
public struct BlockProofEvent has copy, drop {
    block_number: u64,
    sequences: vector<u64>,
    prover: address,
    proof: Proof,
    timestamp: u64,
}

public struct ProofRejectedEvent has copy, drop {
    block_number: u64,
    sequences: vector<u64>,
    prover: address,
    proof: Proof,
}

public struct ProofCalculationRequestEvent has copy, drop {
    proof_calculation: address,
    block_number: u64,
    sequences: vector<u64>,
    circuit: address,
    operation: u8,
}

public struct ProofCalculationCreatedEvent has copy, drop {
    block_number: u64,
    timestamp: u64,
    circuit: address,
}

public struct ProofCalculationInProgressEvent has copy, drop {
    block_number: u64,
    sequences: vector<u64>,
    timestamp: u64,
}

public struct ProofCalculationFinishedEvent has copy, drop {
    block_number: u64,
    sequences: vector<u64>,
    proof: Proof,
    timestamp: u64,
}

public struct ProofCalculationFailedEvent has copy, drop {
    block_number: u64,
    sequences: vector<u64>,
    timestamp: u64,
}

public struct ProofCalculationRejectedEvent has copy, drop {
    block_number: u64,
    sequences: vector<u64>,
    timestamp: u64,
}

public struct ProofCalculationAbandonedEvent has copy, drop {
    block_number: u64,
    timestamp: u64,
}

public struct ProofCalculation has key, store {
    id: UID,
    block_number: u64,
    sequences: Option<vector<u64>>,
    statuses: VecMap<vector<u64>, ProofStatus>,
    circuit: address,
    block_proof: Option<Proof>,
    is_failed: bool,
}

public fun create_circuit(
    name: String,
    description: String,
    package_da_hash: String,
    verification_key_hash: u256,
    verification_key_data: String,
    clock: &Clock,
    ctx: &mut TxContext,
): (Circuit, address) {
    let id = object::new(ctx);
    let timestamp = sui::clock::timestamp_ms(clock);
    let address = id.to_address();
    let circuit = Circuit {
        id,
        name,
        description,
        package_da_hash,
        verification_key_hash,
        verification_key_data,
        created_at: timestamp,
    };
    (circuit, address)
}

public fun create_block_proof_calculation(
    block_number: u64,
    circuit: address,
    sequences: Option<vector<u64>>,
    clock: &Clock,
    ctx: &mut TxContext,
): (ProofCalculation, address) {
    let statuses = empty<vector<u64>, ProofStatus>();
    let id = object::new(ctx);
    let address = id.to_address();
    let timestamp = sui::clock::timestamp_ms(clock);
    let proof_calculation = ProofCalculation {
        id,
        block_number,
        sequences,
        statuses,
        block_proof: option::none(),
        is_failed: false,
        circuit,
    };
    event::emit(ProofCalculationCreatedEvent {
        block_number,
        circuit,
        timestamp,
    });
    //transfer::share_object(proof_calculation);
    (proof_calculation, address)
}

public fun get_proof_calculation_address(proof_calculation: &ProofCalculation): address {
    proof_calculation.id.to_address()
}

public fun request_proof_calculation(
    proof_calculation: &mut ProofCalculation,
    operation: u8,
    sequence: u64,
) {
    insert(
        &mut proof_calculation.statuses,
        vector[sequence],
        ProofStatus {
            operation,
            status: PROOF_STATUS_NOT_STARTED,
            number_of_retries: 0,
            proof: option::none(),
            prover: option::none(),
            is_merge_proof: false,
            input1: option::none(),
            input2: option::none(),
            sequence: option::some(sequence),
            timestamp: option::none(),
        },
    );
    event::emit(ProofCalculationRequestEvent {
        proof_calculation: proof_calculation.id.to_address(),
        block_number: proof_calculation.block_number,
        sequences: vector[sequence],
        circuit: proof_calculation.circuit,
        operation,
    });
}

public fun proof_calculation_in_progress(
    proof_calculation: &mut ProofCalculation,
    sequences: vector<u64>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let status = sui::vec_map::get_mut(&mut proof_calculation.statuses, &sequences);
    status.status = PROOF_STATUS_IN_PROGRESS;
    status.prover = option::some(ctx.sender());
    let timestamp = sui::clock::timestamp_ms(clock);
    status.timestamp = option::some(timestamp);
    event::emit(ProofCalculationInProgressEvent {
        block_number: proof_calculation.block_number,
        sequences,
        timestamp,
    });
}

public fun proof_calculation_failed(
    proof_calculation: &mut ProofCalculation,
    sequences: vector<u64>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let status = sui::vec_map::get_mut(&mut proof_calculation.statuses, &sequences);
    status.status = PROOF_STATUS_FAILED;
    status.prover = option::some(ctx.sender());
    status.number_of_retries = status.number_of_retries + 1;
    if (status.number_of_retries >= MAX_PROOF_RETRIES) {
        status.status = PROOF_STATUS_ABANDONED;
        proof_calculation.is_failed = true;
        event::emit(ProofCalculationAbandonedEvent {
            block_number: proof_calculation.block_number,
            timestamp: sui::clock::timestamp_ms(clock),
        });
    };
    event::emit(ProofCalculationFailedEvent {
        block_number: proof_calculation.block_number,
        sequences,
        timestamp: sui::clock::timestamp_ms(clock),
    });
}

public fun proof_calculation_rejected(
    proof_calculation: &mut ProofCalculation,
    sequences: vector<u64>,
    address: address,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let status = get_mut(&mut proof_calculation.statuses, &sequences);
    if (status.prover == option::some(address)) {
        event::emit(ProofRejectedEvent {
            block_number: proof_calculation.block_number,
            sequences,
            prover: ctx.sender(),
            proof: *option::borrow(&status.proof),
        });
    };
    status.status = PROOF_STATUS_REJECTED;
    status.prover = option::none();
    status.number_of_retries = status.number_of_retries + 1;
    if (status.number_of_retries >= MAX_PROOF_RETRIES) {
        status.status = PROOF_STATUS_ABANDONED;
        proof_calculation.is_failed = true;
        event::emit(ProofCalculationAbandonedEvent {
            block_number: proof_calculation.block_number,
            timestamp: sui::clock::timestamp_ms(clock),
        });
    };
    event::emit(ProofCalculationRejectedEvent {
        block_number: proof_calculation.block_number,
        sequences,
        timestamp: sui::clock::timestamp_ms(clock),
    });
}

// TODO: add prover whitelisting or proof verification
public fun submit_proof(
    proof_calculation: &mut ProofCalculation,
    sequences: vector<u64>, // should be sorted
    publicInput: vector<u256>,
    publicOutput: vector<u256>,
    maxProofsVerified: u8, // should be 2
    proof: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(maxProofsVerified == 2, EInvalidMaxProofsVerified);
    let status = sui::vec_map::get_mut(&mut proof_calculation.statuses, &sequences);
    let timestamp = sui::clock::timestamp_ms(clock);
    status.proof =
        option::some(Proof {
            publicInput,
            publicOutput,
            maxProofsVerified,
            proof,
        });
    status.status = PROOF_STATUS_CALCULATED;
    status.timestamp = option::some(timestamp);
    if (proof_calculation.sequences.is_some()) {
        if (sequences == *option::borrow(&proof_calculation.sequences)) {
            proof_calculation.block_proof =
                option::some(Proof {
                    publicInput,
                    publicOutput,
                    maxProofsVerified,
                    proof,
                });
            event::emit(ProofCalculationFinishedEvent {
                block_number: proof_calculation.block_number,
                sequences,
                proof: *option::borrow(&status.proof),
                timestamp,
            });
        }
    } else {
        event::emit(ProofEvent {
            block_number: proof_calculation.block_number,
            sequences,
            prover: ctx.sender(),
            proof: *option::borrow(&status.proof),
            timestamp,
        });
        let min_sequence = vector::borrow(&sequences, 0);
        let max_sequence = vector::borrow(&sequences, vector::length(&sequences) - 1);
        let keys = /* ERROR: */ /* ERROR: */sui::vec_map::keys<vector<u64>, ProofStatus>(&proof_calculation.statuses);
        let mut i = 0;
        while (i < vector::length(&keys)) {
            let key = vector::borrow(&keys, i);
            let mut status = *get<vector<u64>, ProofStatus>(&proof_calculation.statuses, key);
            if (status.status == PROOF_STATUS_CALCULATED) {
                if (vector::length(key) > 0) {
                    let last_seq = vector::borrow(key, vector::length(key) - 1);
                    if (*last_seq == *min_sequence - 1) {
                        let mut new_sequences = vector::empty<u64>();
                        vector::append(&mut new_sequences, *key);
                        vector::append(&mut new_sequences, sequences);
                        status.status = PROOF_STATUS_USED;
                        event::emit(ProofCalculationRequestEvent {
                            proof_calculation: proof_calculation.id.to_address(),
                            block_number: proof_calculation.block_number,
                            sequences: new_sequences,
                            circuit: proof_calculation.circuit,
                            operation: 0,
                        });

                        insert<vector<u64>, ProofStatus>(
                            &mut proof_calculation.statuses,
                            new_sequences,
                            ProofStatus {
                                operation: OPERATION_MERGE,
                                status: PROOF_STATUS_NOT_STARTED,
                                number_of_retries: 0,
                                proof: option::none(),
                                prover: option::none(),
                                is_merge_proof: true,
                                input1: option::some<vector<u64>>(*key),
                                input2: option::some<vector<u64>>(sequences),
                                sequence: option::none(),
                                timestamp: option::some(timestamp),
                            },
                        );
                        return
                    };
                    let next_seq = vector::borrow(key, 0);
                    if (*next_seq == *max_sequence + 1) {
                        let mut new_sequences = vector::empty<u64>();
                        vector::append(&mut new_sequences, sequences);
                        vector::append(&mut new_sequences, *key);
                        status.status = PROOF_STATUS_USED;
                        event::emit(ProofCalculationRequestEvent {
                            proof_calculation: proof_calculation.id.to_address(),
                            block_number: proof_calculation.block_number,
                            sequences: new_sequences,
                            circuit: proof_calculation.circuit,
                            operation: 0,
                        });

                        insert<vector<u64>, ProofStatus>(
                            &mut proof_calculation.statuses,
                            new_sequences,
                            ProofStatus {
                                operation: OPERATION_MERGE,
                                status: PROOF_STATUS_NOT_STARTED,
                                number_of_retries: 0,
                                proof: option::none(),
                                prover: option::none(),
                                is_merge_proof: true,
                                input1: option::some<vector<u64>>(sequences),
                                input2: option::some<vector<u64>>(*key),
                                sequence: option::none(),
                                timestamp: option::some(timestamp),
                            },
                        );
                        return
                    };
                };
            };
            i = i + 1;
        };
    };
}
