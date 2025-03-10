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

public struct ProofEvent has copy, drop {
    prover: address,
    proof: Proof,
}

public fun submit_proof(proof: Proof, ctx: &mut TxContext) {
    event::emit(ProofEvent {
        prover: ctx.sender(),
        proof,
    });
}
