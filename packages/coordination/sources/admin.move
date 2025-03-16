module dex::admin;

use sui::event;

public struct Admin has key {
    id: UID,
    address: address,
}

public struct AdminCreateEvent has copy, drop {
    address: address,
    admin: address,
}

public(package) fun create_admin(ctx: &mut TxContext) {
    let admin = Admin {
        id: object::new(ctx),
        address: ctx.sender(),
    };
    event::emit(AdminCreateEvent {
        address: admin.id.to_address(),
        admin: ctx.sender(),
    });
    transfer::transfer(admin, ctx.sender());
}

public fun get_admin_address(admin: &Admin): address {
    admin.address
}
