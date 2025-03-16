module dex_config::addresses;

use std::string::String;
use sui::display;
use sui::event;
use sui::package;

public struct Config has copy, drop, store {
    dex_package: address,
    dex_object: address,
    pool_object: address,
    circuit_object: address,
    circuit_blob_id: String,
    mina_network: String,
    mina_chain: String,
    mina_contract: String,
}

public struct DexConfig has key {
    id: UID,
    admin: address,
    config: Option<Config>,
}

public struct ConfigEvent has copy, drop {
    address: address,
    admin: address,
    config: Option<Config>,
}

public struct ADDRESSES has drop {}

fun init(otw: ADDRESSES, ctx: &mut TxContext) {
    let id = object::new(ctx);
    let address = id.to_address();

    let dex_config = DexConfig {
        id,
        admin: ctx.sender(),
        config: option::none(),
    };
    event::emit(ConfigEvent {
        address,
        admin: ctx.sender(),
        config: option::none(),
    });
    transfer::transfer(dex_config, ctx.sender());

    let publisher = package::claim(otw, ctx);

    let keys = vector[
        b"name".to_string(),
        b"link".to_string(),
        b"description".to_string(),
        b"project_url".to_string(),
        b"creator".to_string(),
    ];

    let values = vector[
        b"Silvana DEX Configuration".to_string(),
        b"https://dex.silvana.dev".to_string(),
        b"Silvana DEX configuration for Mina protocol".to_string(),
        b"https://dex.silvana.dev".to_string(),
        b"DFST".to_string(),
    ];
    let mut display_config = display::new_with_fields<DexConfig>(
        &publisher,
        keys,
        values,
        ctx,
    );
    display_config.update_version();
    transfer::public_transfer(publisher, ctx.sender());
    transfer::public_transfer(display_config, ctx.sender());
}

#[error]
const ENotAuthorized: vector<u8> = b"Not authorized";

public fun update_config(
    dex_config: &mut DexConfig,
    dex_package: address,
    dex_object: address,
    pool_object: address,
    circuit_object: address,
    circuit_blob_id: String,
    mina_network: String,
    mina_chain: String,
    mina_contract: String,
    ctx: &mut TxContext,
) {
    assert!(ctx.sender() == dex_config.admin, ENotAuthorized);
    let config: Config = Config {
        dex_package,
        dex_object,
        pool_object,
        circuit_object,
        circuit_blob_id,
        mina_network,
        mina_chain,
        mina_contract,
    };
    dex_config.config = option::some(config);
    event::emit(ConfigEvent {
        address: dex_config.id.to_address(),
        admin: ctx.sender(),
        config: option::some(config),
    });
}
