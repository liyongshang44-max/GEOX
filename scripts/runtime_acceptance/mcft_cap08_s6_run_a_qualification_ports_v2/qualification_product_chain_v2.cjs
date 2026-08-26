'use strict';
const assert=require('node:assert/strict');

function assertResolverRepositoryBindingV2(p){
  const ProductService=p.Cap08S4AppendForwardServiceV1;
  assert.equal(typeof ProductService,'function','QUALIFICATION_V2_S4_SERVICE_REQUIRED');
  p.Cap08S4AppendForwardServiceV1=class QualificationV2Cap08S4AppendForwardServiceV1 extends ProductService{
    constructor(pool,evidenceSource){
      super(pool,evidenceSource);
      assert.ok(Object.prototype.hasOwnProperty.call(this,'repository'),'QUALIFICATION_V2_S4_REPOSITORY_SEAM_REQUIRED');
      assert.ok(Object.prototype.hasOwnProperty.call(this,'resolver'),'QUALIFICATION_V2_S4_RESOLVER_SEAM_REQUIRED');
      assert.ok(this.resolver&&typeof this.resolver==='object','QUALIFICATION_V2_S4_RESOLVER_OBJECT_REQUIRED');
      assert.ok(Object.prototype.hasOwnProperty.call(this.resolver,'repository'),'QUALIFICATION_V2_S4_RESOLVER_REPOSITORY_SEAM_REQUIRED');
      assert.equal(
        this.resolver.repository,
        this.repository,
        'QUALIFICATION_V2_REPLAY_HOST_MUST_OWN_RESOLVER_REPOSITORY_BINDING',
      );
    }
  };
  return p;
}

let capturedRunProductChainV1=null;
function resolveRunProductChainV2(){
  if(capturedRunProductChainV1)return capturedRunProductChainV1;
  const loaderPath=require.resolve('../mcft_cap08_s6_single_run_ports/product_loader_v1.cjs');
  const chainPath=require.resolve('../mcft_cap08_s6_single_run_ports/product_chain_v1.cjs');
  const loaderModule=require(loaderPath);
  const originalLoadProduct=loaderModule.loadProduct;
  assert.equal(typeof originalLoadProduct,'function','QUALIFICATION_V2_ORIGINAL_PRODUCT_LOADER_REQUIRED');
  let chainModule;
  try{
    loaderModule.loadProduct=async root=>assertResolverRepositoryBindingV2(await originalLoadProduct(root));
    delete require.cache[chainPath];
    chainModule=require(chainPath);
  }finally{
    loaderModule.loadProduct=originalLoadProduct;
  }
  assert.equal(typeof chainModule?.runProductChainV1,'function','QUALIFICATION_V2_PRODUCT_CHAIN_REQUIRED');
  capturedRunProductChainV1=chainModule.runProductChainV1;
  return capturedRunProductChainV1;
}

async function runProductChainV2(input){
  return resolveRunProductChainV2()(input);
}

module.exports={
  assertResolverRepositoryBindingV2,
  resolveRunProductChainV2,
  runProductChainV2,
};
