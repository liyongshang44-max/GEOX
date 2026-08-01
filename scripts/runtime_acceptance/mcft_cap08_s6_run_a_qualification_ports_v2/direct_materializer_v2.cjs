'use strict';
const {
  assertQualificationAuthorityV1,
  createDirectQualificationMaterializerV1,
}=require('../mcft_cap08_s6_run_a_qualification_ports/direct_materializer_v1.cjs');
const {runProductChainV2}=require('./qualification_product_chain_v2.cjs');

function createDirectQualificationMaterializerV2(input){
  return createDirectQualificationMaterializerV1({
    ...input,
    runProductChainV1:runProductChainV2,
  });
}

module.exports={
  assertQualificationAuthorityV1,
  createDirectQualificationMaterializerV2,
};
