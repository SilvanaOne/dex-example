module dex::prover;

use std::string::String;
use sui::clock::Clock;
use sui::event;
use sui::vec_map::{VecMap, contains, insert, get_mut, empty};

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

const PROOF_STATUS_CALCULATED: u8 = 1;
const PROOF_STATUS_REJECTED: u8 = 2;
const PROOF_STATUS_USED: u8 = 3;

public struct Proof has copy, drop, store {
    da_hash: String,
    status: u8,
    timestamp: u64,
}

public struct ProofSubmittedEvent has copy, drop {
    block_number: u64,
    sequences: vector<u64>,
    da_hash: String,
    timestamp: u64,
    prover: address,
}

public struct ProofUsedEvent has copy, drop {
    block_number: u64,
    sequences: vector<u64>,
    da_hash: String,
    timestamp: u64,
    verifier: address,
}

public struct ProofRejectedEvent has copy, drop {
    block_number: u64,
    sequences: vector<u64>,
    timestamp: u64,
    verifier: address,
}

public struct BlockProofEvent has copy, drop {
    block_number: u64,
    start_sequence: u64,
    end_sequence: u64,
    da_hash: String,
    timestamp: u64,
}

public struct ProofCalculation has key, store {
    id: UID,
    block_number: u64,
    start_sequence: u64,
    end_sequence: Option<u64>,
    proofs: VecMap<vector<u64>, Proof>,
    circuit: address,
    block_proof: Option<String>,
    is_finished: bool,
}

public struct ProofCalculationCreatedEvent has copy, drop {
    block_number: u64,
    start_sequence: u64,
    end_sequence: Option<u64>,
    circuit: address,
    timestamp: u64,
}

public(package) fun create_circuit(
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

public(package) fun create_block_proof_calculation(
    block_number: u64,
    circuit: address,
    start_sequence: u64,
    end_sequence: Option<u64>,
    clock: &Clock,
    ctx: &mut TxContext,
): (ProofCalculation, address) {
    let proofs = empty<vector<u64>, Proof>();
    let id = object::new(ctx);
    let address = id.to_address();
    let timestamp = sui::clock::timestamp_ms(clock);
    let proof_calculation = ProofCalculation {
        id,
        block_number,
        start_sequence,
        end_sequence,
        proofs,
        block_proof: option::none(),
        is_finished: block_number == 0,
        circuit,
    };
    event::emit(ProofCalculationCreatedEvent {
        block_number,
        start_sequence,
        end_sequence,
        circuit,
        timestamp,
    });
    (proof_calculation, address)
}

public(package) fun finish_proof_calculation(
    proof_calculation: &mut ProofCalculation,
    end_sequence: u64,
    block_proof: String,
    clock: &Clock,
) {
    proof_calculation.block_proof = option::some(block_proof);
    proof_calculation.end_sequence = option::some(end_sequence);
    proof_calculation.is_finished = true;
    event::emit(BlockProofEvent {
        block_number: proof_calculation.block_number,
        start_sequence: proof_calculation.start_sequence,
        end_sequence,
        da_hash: block_proof,
        timestamp: sui::clock::timestamp_ms(clock),
    });
}

public(package) fun set_end_sequence(
    proof_calculation: &mut ProofCalculation,
    end_sequence: u64,
    clock: &Clock,
): bool {
    proof_calculation.end_sequence = option::some(end_sequence);
    let mut i = proof_calculation.start_sequence;
    let mut sequences = vector::empty<u64>();
    while (i <= end_sequence) {
        vector::push_back(&mut sequences, i);
        i = i + 1;
    };
    if (contains(&proof_calculation.proofs, &sequences)) {
        let proof = get_mut(&mut proof_calculation.proofs, &sequences);
        finish_proof_calculation(
            proof_calculation,
            end_sequence,
            proof.da_hash,
            clock,
        );
        return true
    };
    false
}

public fun get_proof_calculation_address(proof_calculation: &ProofCalculation): address {
    proof_calculation.id.to_address()
}

public fun get_proof_calculation_end_sequence(proof_calculation: &ProofCalculation): Option<u64> {
    proof_calculation.end_sequence
}

public fun is_finished(proof_calculation: &ProofCalculation): bool {
    proof_calculation.is_finished
}

#[error]
const ENotCalculated: vector<u8> = b"Proof calculation not calculated";

public fun reject_proof(
    proof_calculation: &mut ProofCalculation,
    sequences: vector<u64>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let proof = get_mut(&mut proof_calculation.proofs, &sequences);
    assert!(proof.status == PROOF_STATUS_CALCULATED, ENotCalculated);
    proof.status = PROOF_STATUS_REJECTED;

    event::emit(ProofRejectedEvent {
        block_number: proof_calculation.block_number,
        sequences,
        timestamp: sui::clock::timestamp_ms(clock),
        verifier: ctx.sender(),
    });
}

// TODO: add prover whitelisting or proof verification
public fun submit_proof(
    proof_calculation: &mut ProofCalculation,
    sequences: vector<u64>, // should be sorted
    da_hash: String,
    clock: &Clock,
    ctx: &mut TxContext,
): bool {
    let proof = Proof {
        da_hash,
        status: PROOF_STATUS_CALCULATED,
        timestamp: sui::clock::timestamp_ms(clock),
    };
    event::emit(ProofSubmittedEvent {
        block_number: proof_calculation.block_number,
        sequences,
        da_hash,
        timestamp: sui::clock::timestamp_ms(clock),
        prover: ctx.sender(),
    });
    if (contains(&proof_calculation.proofs, &sequences)) {
        let proof = get_mut(&mut proof_calculation.proofs, &sequences);
        proof.da_hash = da_hash;
        proof.status = PROOF_STATUS_CALCULATED;
        proof.timestamp = sui::clock::timestamp_ms(clock);
    } else {
        insert(&mut proof_calculation.proofs, sequences, proof);
    };
    if (proof_calculation.end_sequence.is_some()) {
        let end_sequence = *proof_calculation.end_sequence.borrow();
        if (
            sequences[0]==proof_calculation.start_sequence && 
            sequences[vector::length(&sequences)-1] == end_sequence
        ) {
            finish_proof_calculation(
                proof_calculation,
                end_sequence,
                da_hash,
                clock,
            );
            return true
        }
    };
    false
}

public(package) fun use_proof(
    proof_calculation: &mut ProofCalculation,
    sequences: vector<u64>, // should be sorted
    clock: &Clock,
    ctx: &TxContext,
) {
    let proof = get_mut(&mut proof_calculation.proofs, &sequences);
    proof.status = PROOF_STATUS_USED;
    proof.timestamp = sui::clock::timestamp_ms(clock);
    event::emit(ProofUsedEvent {
        block_number: proof_calculation.block_number,
        sequences,
        da_hash: proof.da_hash,
        timestamp: proof.timestamp,
        verifier: ctx.sender(),
    });
}
