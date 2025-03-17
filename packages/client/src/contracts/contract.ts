import {
  Field,
  AccountUpdate,
  UInt64,
  PublicKey,
  state,
  State,
  SmartContract,
  method,
  Bool,
  DeployArgs,
  Permissions,
} from "o1js";
import { RollupDEXState, DEXMap } from "./provable-types.js";
import { DEXProof } from "./rollup.js";

const newMap = new DEXMap();
/*
export class RollupDEXState extends Struct({
  poolPublicKey: PublicKey,
  root: Field,
  length: Field,
  actionState: Field, // TODO: check in production
  sequence: UInt64,
}) {
*/

interface DEXContractDeployProps extends Exclude<DeployArgs, undefined> {
  admin: PublicKey;
  uri: string;
}

export class DEXContract extends SmartContract {
  @state(PublicKey) admin = State<PublicKey>();
  @state(Field) root = State<Field>(Field(0));
  @state(Field) length = State<Field>(Field(0));
  @state(Field) actionState = State<Field>(Field(0));
  @state(UInt64) sequence = State<UInt64>(UInt64.from(0));

  /**
   * Deploys the contract with initial settings.
   * @param props - Deployment properties including admin, upgradeAuthority, uri, canPause, and isPaused.
   */
  async deploy(props: DEXContractDeployProps) {
    await super.deploy(props);
    this.admin.set(props.admin);
    this.root.set(newMap.root);
    this.length.set(newMap.length);
    this.actionState.set(Field(0)); // TODO: update in production
    this.sequence.set(UInt64.zero);

    this.account.zkappUri.set(props.uri);
    this.account.permissions.set({
      ...Permissions.default(),
      // Allow the upgrade authority to set the verification key
      // even when there is no protocol upgrade
      setVerificationKey:
        Permissions.VerificationKey.proofDuringCurrentVersion(),
      setPermissions: Permissions.impossible(),
      access: Permissions.proof(),
      send: Permissions.proof(),
      setZkappUri: Permissions.proof(),
      setTokenSymbol: Permissions.proof(),
    });
  }

  events = {
    settle: RollupDEXState,
  };

  @method async settle(proof: DEXProof) {
    const sender = this.sender.getUnconstrained();
    const senderUpdate = AccountUpdate.createSigned(sender);
    senderUpdate.body.useFullCommitment = Bool(true);

    const sequence = this.sequence.getAndRequireEquals();
    const actionState = this.actionState.getAndRequireEquals();
    const root = this.root.getAndRequireEquals();
    const length = this.length.getAndRequireEquals();

    proof.publicInput.root.assertEquals(root);
    proof.publicInput.length.assertEquals(length);
    proof.publicInput.actionState.assertEquals(actionState);
    proof.publicInput.sequence.assertEquals(sequence);
    proof.publicInput.poolPublicKey.assertEquals(this.address);

    proof.verify();

    this.sequence.set(proof.publicOutput.sequence);
    this.actionState.set(proof.publicOutput.actionState);
    this.root.set(proof.publicOutput.root);
    this.length.set(proof.publicOutput.length);

    this.emitEvent("settle", proof.publicOutput);
  }
}
