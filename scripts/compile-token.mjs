import solc from 'solc';
import fs from 'fs';

const source = fs.readFileSync('contracts/FledgeToken.sol', 'utf8');
const input = {
  language: 'Solidity',
  sources: { 'FledgeToken.sol': { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
  },
};

const out = JSON.parse(solc.compile(JSON.stringify(input)));
const errs = (out.errors || []).filter((e) => e.severity === 'error');
if (errs.length) {
  console.error(errs.map((e) => e.formattedMessage).join('\n'));
  process.exit(1);
}
const c = out.contracts['FledgeToken.sol']['FledgeToken'];
const artifact = { abi: c.abi, bytecode: '0x' + c.evm.bytecode.object };
fs.mkdirSync('src/app', { recursive: true });
fs.writeFileSync('src/app/token-artifact.json', JSON.stringify(artifact, null, 2));
console.log('wrote src/app/token-artifact.json — bytecode', artifact.bytecode.length, 'chars, abi', artifact.abi.length, 'entries');
