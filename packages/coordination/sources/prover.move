module dex::prover;

use sui::event;

#[allow(unused_field)]
public struct Proof has copy, drop {
    sequences: vector<u64>,
    publicInput: vector<u256>,
    publicOutput: vector<u256>,
    maxProofsVerified: u8,
    proof: vector<u8>,
}

#[allow(unused_field)]
public struct BlockProof has copy, drop {
    block_number: u64,
    proof: Proof,
}

public struct ProofEvent has copy, drop {
    prover: address,
    proof: Proof,
}

public struct BlockProofEvent has copy, drop {
    prover: address,
    proof: BlockProof,
}

public fun submit_proof(proof: Proof, ctx: &mut TxContext) {
    event::emit(ProofEvent {
        prover: ctx.sender(),
        proof,
    });
}

public fun submit_block_proof(proof: BlockProof, ctx: &mut TxContext) {
    event::emit(BlockProofEvent {
        prover: ctx.sender(),
        proof,
    });
}
