'use strict';

const assert=require('node:assert/strict');
const {product}=require('./mcft_cap08_s6_single_run_ports/shared_v1.cjs');
const {createS6S4AtomicPersistenceRepositoryV1}=require('./mcft_cap08_s6_single_run_ports/s6_s4_atomic_persistence_repository_v1.cjs');

let capturedRunProductChainV1=null;
let capturedRoot=null;

async function resolveRunProductChainV1(root){
  if(capturedRunProductChainV1){
    assert.equal(root,capturedRoot,'PHASE1_TYPED_REPLAY_HOST_ROOT_DRIFT');
    return capturedRunProductChainV1;
  }

  const loaderPath=require.resolve('./mcft_cap08_s6_single_run_ports/product_loader_v1.cjs');
  const chainPath=require.resolve('./mcft_cap08_s6_single_run_ports/product_chain_v1.cjs');
  const loaderModule=require(loaderPath);
  const originalLoadProduct=loaderModule.loadProduct;
  assert.equal(typeof originalLoadProduct,'function','PHASE1_TYPED_REPLAY_HOST_ORIGINAL_LOADER_REQUIRED');

  let chainModule;
  try{
    loaderModule.loadProduct=async candidateRoot=>{
      const p=await originalLoadProduct(candidateRoot);
      const composition=await product(
        candidateRoot,
        'apps/server/src/runtime/twin_runtime/cap08_replay_host_composition_v1.ts',
      );
      const createReplayHostS4=composition.createCap08ReplayHostS4AppendForwardServiceV1;
      assert.equal(typeof createReplayHostS4,'function','PHASE1_TYPED_REPLAY_HOST_FACTORY_REQUIRED');

      p.Cap08S4AppendForwardServiceV1=class Phase1TypedReplayHostS4AppendForwardServiceV1{
        constructor(pool,evidenceSource){
          return createReplayHostS4({
            pool,
            evidence_source:evidenceSource,
            repository:createS6S4AtomicPersistenceRepositoryV1({pool,p}),
          });
        }
      };
      return p;
    };
    delete require.cache[chainPath];
    chainModule=require(chainPath);
  }finally{
    loaderModule.loadProduct=originalLoadProduct;
  }

  assert.equal(typeof chainModule?.runProductChainV1,'function','PHASE1_TYPED_REPLAY_HOST_PRODUCT_CHAIN_REQUIRED');
  capturedRunProductChainV1=chainModule.runProductChainV1;
  capturedRoot=root;
  return capturedRunProductChainV1;
}

async function runPhase1TypedReplayHostProductChainV1(input){
  const runProductChainV1=await resolveRunProductChainV1(input.root);
  return runProductChainV1(input);
}

module.exports={
  resolveRunProductChainV1,
  runPhase1TypedReplayHostProductChainV1,
};
