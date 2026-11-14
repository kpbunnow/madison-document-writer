import copy, hashlib, json, pathlib, tempfile
import case_integrity as integrity
import case_store
from audit_r28_helper import pair
root=pathlib.Path(__file__).resolve().parent.parent
value=pair(); value['schema']=5
with tempfile.TemporaryDirectory(prefix='phase6-synthetic-', dir=root/'runtime') as folder:
    folder=pathlib.Path(folder)
    first=case_store.save_case(folder,'101 TEST LANE - QA-LIFE.json',value)
    target=folder/first['name']; before=target.read_bytes(); head=first['file']['integrity']['headHash']
    good=first['file']; assert integrity.verify_record(good,folder)['valid']
    bad=copy.deepcopy(good); bad['integrity']['genesis']['committedAt']='2000-01-01T00:00:00Z'
    invalid=integrity.verify_record(bad,folder)
    assert not invalid['valid'] and invalid['eventId']=='genesis'
    changed=copy.deepcopy(value); changed['events'][0]['payload']['snapshot']['items'][0]['text']='Synthetic changed immutable issued fact'
    try: case_store.save_case(folder,first['name'],changed,first['revision'],value['case'])
    except ValueError as error: refusal={'class':type(error).__name__,'message':str(error)}
    else: raise AssertionError('changed issued event was accepted')
    assert target.read_bytes()==before
    current=case_store.read_case(folder,first['name'])
    assert current['integrity']['valid'] and current['file']['integrity']['headHash']==head
    (root/'runtime/proof-fixture.json').write_text(json.dumps({'good':good,'bad':bad}),encoding='utf-8')
    receipt={'scenario':'source-integrity-proof','owners':['case_integrity.verify_record','integrity_verification.genesis_events','case_store.save_case'], 'valid_original':True,'altered_proof_verdict':{k:invalid[k] for k in ['valid','eventId','label']},'changed_issued_event_refusal':refusal,'original_sha256_before':hashlib.sha256(before).hexdigest(),'original_sha256_after':hashlib.sha256(target.read_bytes()).hexdigest(),'original_head_before':head,'original_head_after':current['file']['integrity']['headHash'],'pending_transaction_count':len(list((folder/'_integrity/transactions').glob('*.json'))),'original_event_count':len(good['events']),'current_event_count':len(current['file']['events'])}
    print(json.dumps(receipt))
    (root/'evidence/proof-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
