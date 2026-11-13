from pathlib import Path

from app.knowledge import KnowledgeBase, _tokenize


def test_tokenize_handles_parentheses():
    tokens = _tokenize('NetworkOptix (Nx Witness) integration')
    assert 'networkoptix' in tokens
    assert 'nx' in tokens
    assert 'witness' in tokens


def test_most_relevant_returns_partner_chunk():
    kb = KnowledgeBase(Path('data/knowledge'))
    chunks = kb.most_relevant('What is Nx Witness?', top_k=5)
    joined = ' '.join(chunk.text.lower() for chunk in chunks)
    assert 'networkoptix (nx witness)'.lower() in joined
