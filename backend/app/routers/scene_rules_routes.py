from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Camera, SceneRule, User, ZoneTopology
from app.schemas import (
    SceneRuleCreate,
    SceneRuleOut,
    SceneRuleUpdate,
    ZoneTopologyCreate,
    ZoneTopologyOut,
)

router = APIRouter()


@router.get("", response_model=list[SceneRuleOut])
def list_rules(
    camera_id: int | None = Query(None),
    rule_type: str | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[SceneRule]:
    q = db.query(SceneRule).order_by(SceneRule.id.asc())
    if camera_id is not None:
        q = q.filter(SceneRule.camera_id == camera_id)
    if rule_type:
        q = q.filter(SceneRule.rule_type == rule_type)
    return q.all()


@router.post("", response_model=SceneRuleOut, status_code=status.HTTP_201_CREATED)
def create_rule(
    body: SceneRuleCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> SceneRule:
    if body.camera_id is not None and db.query(Camera).filter(Camera.id == body.camera_id).first() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")
    row = SceneRule(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/topology/list", response_model=list[ZoneTopologyOut])
def list_topology(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ZoneTopology]:
    return db.query(ZoneTopology).order_by(ZoneTopology.id.asc()).all()


@router.post("/topology", response_model=ZoneTopologyOut, status_code=status.HTTP_201_CREATED)
def create_topology(
    body: ZoneTopologyCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ZoneTopology:
    for zid in (body.zone_a_id, body.zone_b_id):
        if db.query(SceneRule).filter(SceneRule.id == zid).first() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Scene rule {zid} not found")
    row = ZoneTopology(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/{rule_id}", response_model=SceneRuleOut)
def get_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> SceneRule:
    row = db.query(SceneRule).filter(SceneRule.id == rule_id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene rule not found")
    return row


@router.put("/{rule_id}", response_model=SceneRuleOut)
def update_rule(
    rule_id: int,
    body: SceneRuleUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> SceneRule:
    row = db.query(SceneRule).filter(SceneRule.id == rule_id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene rule not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> None:
    row = db.query(SceneRule).filter(SceneRule.id == rule_id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene rule not found")
    db.delete(row)
    db.commit()


